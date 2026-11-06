const reportService=require("../services/report.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

const sendFile=(res,{buffer,filename},contentType)=>{
    res.setHeader("Content-Type",contentType);
    res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers","Content-Disposition");
    return res.status(200).send(Buffer.from(buffer));
};

// GET /order/:id/invoice  (owner or admin) -> .docx
const invoice=async(req,res)=>{
    try{
        const file=await reportService.generateInvoice(req.user,req.params.id);
        return sendFile(res,file,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
    catch(error){
        return handleError(res,error,"Generate invoice");
    }
};

// GET /order/admin/report?from=&to=  -> JSON
const report=async(req,res)=>{
    try{
        const data=await reportService.buildReport(req.query);
        return res.status(200).json({message:"Order report",data});
    }
    catch(error){
        return handleError(res,error,"Order report");
    }
};

// GET /order/admin/report/export?from=&to=  -> .xlsx
const reportExport=async(req,res)=>{
    try{
        const file=await reportService.buildReportExcel(req.query);
        return sendFile(res,file,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    catch(error){
        return handleError(res,error,"Export order report");
    }
};

module.exports={invoice,report,reportExport};
