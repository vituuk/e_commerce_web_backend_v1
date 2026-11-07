const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const {handleUpload}=require("../middleware/upload");
const profileController=require("../controllers/user-profile.controller");

const router=express.Router();

// GET /auth/profile : any logged-in user, own account + profile
router.get("/profile",authenticate,profileController.getMine);
// POST /auth/profile : create own profile (only once)
router.post("/profile",authenticate,profileController.create);
// PUT /auth/profile : update own existing profile (send only fields to change)
router.put("/profile",authenticate,profileController.update);
// POST /auth/profile/avatar : upload avatar image file and return its URL
router.post("/profile/avatar",authenticate,handleUpload,(req,res)=>{
    if(!req.file){
        return res.status(400).json({message:"image file is required (form field 'image')"});
    }
    const url=req.file.cloudinaryUrl || `/uploads/products/${req.file.filename}`;
    return res.status(201).json({message:"Avatar uploaded",data:{url}});
});
// Admin: view, create, update, or delete any user's profile
router.get("/profile/:userId",authenticate,authorize("admin"),profileController.getByUserId);
router.post("/profile/:userId",authenticate,authorize("admin"),profileController.createByUserId);
router.put("/profile/:userId",authenticate,authorize("admin"),profileController.updateByUserId);
router.delete("/profile/:userId",authenticate,authorize("admin"),profileController.removeByUserId);

module.exports=router;
