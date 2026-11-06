// AppError -> its status (+ optional extra fields); anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message,...(error.extra || {})});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

module.exports=handleError;