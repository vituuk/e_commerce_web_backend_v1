// Shared pagination helper
// usage: const {page,limit,offset}=getPagination(req.query);
//        const {rows,count}=await Model.findAndCountAll({...,limit,offset,distinct:true});
//        res.json({data:rows,pagination:buildPagination(count,page,limit)});

const DEFAULT_LIMIT=10;
const MAX_LIMIT=100;

const toPositiveInt=(value,fallback)=>{
    const n=parseInt(value,10);
    return Number.isInteger(n) && n>0 ? n : fallback;
};

// ?page=2&limit=20 -> {page:2,limit:20,offset:20}
// invalid values fall back to defaults; limit is capped at MAX_LIMIT
const getPagination=(query={})=>{
    const page=toPositiveInt(query.page,1);
    const limit=Math.min(toPositiveInt(query.limit,DEFAULT_LIMIT),MAX_LIMIT);
    return {page,limit,offset:(page-1)*limit};
};

const buildPagination=(total,page,limit)=>{
    const total_pages=Math.max(Math.ceil(total/limit),1);
    return {
        page,
        limit,
        total,
        total_pages,
        has_next:page<total_pages,
        has_prev:page>1
    };
};

// one call: findAndCountAll with page/limit from query -> {rows,pagination}
const paginate=async(Model,options,query)=>{
    const {page,limit,offset}=getPagination(query);
    const {rows,count}=await Model.findAndCountAll({...options,limit,offset,distinct:true});
    return {rows,pagination:buildPagination(count,page,limit)};
};

// "true"/"false" query string -> boolean, anything else -> undefined
const parseBool=(value)=>value==="true" ? true : value==="false" ? false : undefined;

module.exports={getPagination,buildPagination,paginate,parseBool,DEFAULT_LIMIT,MAX_LIMIT};
