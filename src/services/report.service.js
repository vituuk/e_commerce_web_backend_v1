const fs=require("fs");
const path=require("path");
const PizZip=require("pizzip");
const Docxtemplater=require("docxtemplater");
const ExcelJS=require("exceljs");
const {Op,fn,col,literal}=require("sequelize");
const {Order,OrderItem,Payment,User}=require("../../models");
const AppError=require("../util/app-error");

const TEMPLATE_DIR=path.join(__dirname,"..","template");
const INVOICE_TEMPLATE=process.env.INVOICE_TEMPLATE || "invoice_template.docx";

const money=(n)=>Number(n || 0).toFixed(2);
const fmtDate=(d)=>d ? new Date(d).toISOString().slice(0,10) : "";

// ================= INVOICE (.docx) =================

// owner can download own invoice; admin/superadmin can download any
const loadOrderForInvoice=async(user,id)=>{
    const roles=(user && user.roles) || [];
    const isAdmin=roles.includes("admin") || roles.includes("superadmin");
    const where=isAdmin ? {id} : {id,userId:user.id};
    const order=await Order.findOne({
        where,
        include:[
            {model:OrderItem,as:"items"},
            {model:User,as:"user",attributes:["id","firstName","lastName","email"]}
        ],
        order:[[{model:OrderItem,as:"items"},"id","ASC"]]
    });
    if(!order) throw new AppError(404,"Order not found");
    if(order.status==="cancelled") throw new AppError(400,"Cancelled orders have no invoice");
    return order;
};

// values available inside the .docx template as {placeholder}
const buildInvoiceData=async(order)=>{
    const payment=await Payment.findOne({
        where:{orderId:order.id,status:"success"},
        order:[["paidAt","DESC"]]
    });
    return {
        invoice_number:order.order_number.replace(/^ORD/,"INV"),
        order_number:order.order_number,
        order_date:fmtDate(order.createdAt),
        status:order.status,
        customer_name:`${order.user?.firstName || ""} ${order.user?.lastName || ""}`.trim(),
        customer_email:order.user?.email || "",
        receiver_name:order.shipping_receiver_name,
        phone:order.shipping_phone,
        street:order.shipping_street,
        city:order.shipping_city,
        items:order.items.map((i,idx)=>({
            no:idx+1,
            product_name:i.product_name,
            sku:i.sku,
            variant:[i.color,i.size].filter(Boolean).join(" / "),
            quantity:i.quantity,
            unit_price:money(i.unit_price),
            amount:money(i.amount)
        })),
        sub_total:money(order.sub_total),
        discount:money(order.discount),
        shipping_fee:money(order.shipping_fee),
        total:money(order.total),
        payment_method:payment ? payment.method : "",
        payment_status:payment ? "PAID" : "UNPAID",
        paid_at:payment ? fmtDate(payment.paidAt) : "",
        tran_id:payment ? payment.paywayTranId : ""
    };
};

const generateInvoice=async(user,id)=>{
    const order=await loadOrderForInvoice(user,id);
    const templatePath=path.join(TEMPLATE_DIR,INVOICE_TEMPLATE);
    if(!fs.existsSync(templatePath)) throw new AppError(500,`Invoice template not found: src/template/${INVOICE_TEMPLATE}`);

    const zip=new PizZip(fs.readFileSync(templatePath,"binary"));
    const doc=new Docxtemplater(zip,{
        paragraphLoop:true,
        linebreaks:true,
        nullGetter:()=>"" // unknown placeholder -> empty instead of "undefined"
    });
    try{
        doc.render(await buildInvoiceData(order));
    }
    catch(err){
        // template syntax problems (e.g. unclosed {#items})
        const details=(err.properties?.errors || []).map(e=>e.properties?.explanation).filter(Boolean).join("; ");
        throw new AppError(500,`Invoice template error: ${details || err.message}`);
    }

    return {
        buffer:doc.getZip().generate({type:"nodebuffer",compression:"DEFLATE"}),
        filename:`invoice-${order.order_number}.docx`
    };
};

// ================= ORDER REPORT =================

// ?from=2026-10-01&to=2026-10-31 (inclusive), default: last 30 days
const parseRange=(query)=>{
    const to=query.to ? new Date(query.to) : new Date();
    const from=query.from ? new Date(query.from) : new Date(to.getTime()-29*24*60*60*1000);
    if(isNaN(from) || isNaN(to)) throw new AppError(400,"from/to must be valid dates (YYYY-MM-DD)");
    from.setHours(0,0,0,0);
    to.setHours(23,59,59,999);
    if(from>to) throw new AppError(400,"from must be before to");
    return {from,to};
};

const buildReport=async(query)=>{
    const {from,to}=parseRange(query);
    const inRange={createdAt:{[Op.between]:[from,to]}};
    const PAID_STATUSES=["paid","shipped","delivered"];
    const ACTIVE_STATUSES=["pending","paid","shipped","delivered"];

    const byStatusRows=await Order.findAll({
        where:inRange,
        attributes:[
            "status",
            [fn("COUNT",col("id")),"count"],
            [fn("SUM",col("sub_total")),"sub_total"],
            [fn("SUM",col("discount")),"discount"],
            [fn("SUM",col("shipping_fee")),"shipping_fee"],
            [fn("SUM",col("total")),"total"]
        ],
        group:["status"],
        raw:true
    });
    const by_status={pending:0,paid:0,shipped:0,delivered:0,cancelled:0};
    let total_orders=0,active_orders=0,sub_total_sum=0,total_discount=0,total_shipping=0,revenue=0;
    byStatusRows.forEach(r=>{
        const cnt=Number(r.count || 0);
        by_status[r.status]=cnt;
        total_orders+=cnt;
        if(ACTIVE_STATUSES.includes(r.status)){
            active_orders+=cnt;
            sub_total_sum+=Number(r.sub_total || 0);
            total_discount+=Number(r.discount || 0);
            total_shipping+=Number(r.shipping_fee || 0);
            revenue+=Number(r.total || 0);
        }
    });
    const paid_orders=PAID_STATUSES.reduce((s,k)=>s+by_status[k],0);

    const top_products=await OrderItem.findAll({
        attributes:[
            "product_name",
            [fn("SUM",col("quantity")),"quantity"],
            [fn("SUM",col("amount")),"revenue"]
        ],
        include:[{model:Order,as:"order",attributes:[],where:{...inRange,status:ACTIVE_STATUSES}}],
        group:["product_name"],
        order:[[literal('SUM("quantity")'),"DESC"]],
        limit:10,
        raw:true
    });

    const daily=await Order.findAll({
        where:{...inRange,status:ACTIVE_STATUSES},
        attributes:[
            [fn("DATE",col("createdAt")),"date"],
            [fn("COUNT",col("id")),"orders"],
            [fn("SUM",col("total")),"revenue"]
        ],
        group:[fn("DATE",col("createdAt"))],
        order:[[fn("DATE",col("createdAt")),"ASC"]],
        raw:true
    });

    return {
        from:fmtDate(from),
        to:fmtDate(to),
        total_orders,
        paid_orders,
        sub_total:Number(money(sub_total_sum)),
        total_discount:Number(money(total_discount)),
        total_shipping:Number(money(total_shipping)),
        revenue:Number(money(revenue)),
        average_order_value:active_orders ? Number(money(revenue/active_orders)) : 0,
        by_status,
        top_products:top_products.map(p=>({product_name:p.product_name,quantity:Number(p.quantity),revenue:Number(money(p.revenue))})),
        daily:daily.map(d=>({date:fmtDate(d.date),orders:Number(d.orders),revenue:Number(money(d.revenue))}))
    };
};

// same report + full order list as .xlsx
const buildReportExcel=async(query)=>{
    const report=await buildReport(query);
    const {from,to}=parseRange(query);
    const orders=await Order.findAll({
        where:{createdAt:{[Op.between]:[from,to]}},
        include:[{model:User,as:"user",attributes:["firstName","lastName","email"]}],
        order:[["createdAt","ASC"]]
    });

    const wb=new ExcelJS.Workbook();
    wb.creator="Mini Ecommerce";
    const bold={font:{bold:true}};

    // Summary
    const s=wb.addWorksheet("Summary");
    s.columns=[{width:24},{width:18}];
    s.addRow(["Order Report"]).font={bold:true,size:14};
    s.addRow(["From",report.from]);
    s.addRow(["To",report.to]);
    s.addRow([]);
    s.addRow(["Total orders",report.total_orders]);
    s.addRow(["Paid orders",report.paid_orders]);
    s.addRow(["Subtotal (USD)",report.sub_total]);
    s.addRow(["Total discount (USD)",report.total_discount]);
    s.addRow(["Total shipping (USD)",report.total_shipping]);
    s.addRow(["Revenue (USD)",report.revenue]);
    s.addRow(["Average order value",report.average_order_value]);
    s.addRow([]);
    s.addRow(["Status","Count"]).eachCell(c=>c.style=bold);
    Object.entries(report.by_status).forEach(([k,v])=>s.addRow([k,v]));

    // Orders
    const o=wb.addWorksheet("Orders");
    o.columns=[
        {header:"Order #",key:"order_number",width:22},
        {header:"Date",key:"date",width:12},
        {header:"Customer",key:"customer",width:22},
        {header:"Email",key:"email",width:26},
        {header:"City",key:"city",width:14},
        {header:"Status",key:"status",width:11},
        {header:"Sub total",key:"sub_total",width:11},
        {header:"Discount",key:"discount",width:10},
        {header:"Shipping",key:"shipping_fee",width:10},
        {header:"Total",key:"total",width:11}
    ];
    o.getRow(1).font={bold:true};
    orders.forEach(ord=>o.addRow({
        order_number:ord.order_number,
        date:fmtDate(ord.createdAt),
        customer:`${ord.user?.firstName || ""} ${ord.user?.lastName || ""}`.trim(),
        email:ord.user?.email || "",
        city:ord.shipping_city,
        status:ord.status,
        sub_total:Number(ord.sub_total),
        discount:Number(ord.discount),
        shipping_fee:Number(ord.shipping_fee),
        total:Number(ord.total)
    }));

    // Top products
    const t=wb.addWorksheet("Top products");
    t.columns=[
        {header:"Product",key:"product_name",width:30},
        {header:"Quantity",key:"quantity",width:10},
        {header:"Revenue",key:"revenue",width:12}
    ];
    t.getRow(1).font={bold:true};
    report.top_products.forEach(p=>t.addRow(p));

    // Daily
    const d=wb.addWorksheet("Daily");
    d.columns=[
        {header:"Date",key:"date",width:12},
        {header:"Orders",key:"orders",width:10},
        {header:"Revenue",key:"revenue",width:12}
    ];
    d.getRow(1).font={bold:true};
    report.daily.forEach(r=>d.addRow(r));

    return {
        buffer:await wb.xlsx.writeBuffer(),
        filename:`order-report-${report.from}_to_${report.to}.xlsx`
    };
};

module.exports={generateInvoice,buildReport,buildReportExcel};
