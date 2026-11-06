const multer=require("multer");
const path=require("path");
const fs=require("fs");

// files are saved to src/storage/products and served at /uploads/products/<file>
const UPLOAD_DIR=path.join(__dirname,"..","storage","products");
fs.mkdirSync(UPLOAD_DIR,{recursive:true});

const ALLOWED=["image/jpeg","image/png","image/webp","image/gif"];

const storage=multer.diskStorage({
    destination:(req,file,cb)=>cb(null,UPLOAD_DIR),
    filename:(req,file,cb)=>{
        const ext=path.extname(file.originalname).toLowerCase();
        cb(null,`product-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
    }
});

const uploadProductImage=multer({
    storage,
    limits:{fileSize:5*1024*1024}, // 5MB
    fileFilter:(req,file,cb)=>{
        if(!ALLOWED.includes(file.mimetype)){
            return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE","image"));
        }
        cb(null,true);
    }
}).single("image");

// wraps multer so its errors become 400 JSON instead of crashing the request
const handleUpload=(req,res,next)=>{
    uploadProductImage(req,res,(err)=>{
        if(err instanceof multer.MulterError){
            if(err.code==="LIMIT_FILE_SIZE"){
                return res.status(400).json({message:"Image must be 5MB or smaller"});
            }
            return res.status(400).json({message:"Field 'image' must be a jpeg, png, webp or gif file"});
        }
        if(err){
            return res.status(400).json({message:err.message});
        }
        next();
    });
};

// "/uploads/products/x.png" -> absolute path on disk
const deleteUploadedFile=(url)=>{
    if(!url || !url.startsWith("/uploads/products/")) return;
    const file=path.join(UPLOAD_DIR,path.basename(url));
    fs.unlink(file,()=>{}); // ignore if already missing
};

module.exports={handleUpload,deleteUploadedFile,UPLOAD_DIR};
