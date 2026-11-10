const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "e-commerce-web-v1",
      resource_type: "auto", // Automatically detects image, video, or raw document (PDF, DOCX, etc.)
      allowed_formats: [
        "jpeg",
        "png",
        "jpg",
        "webp",
        "gif",
        "svg",
        "avif",
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "txt",
        "csv",
      ],
    };
  },
});

module.exports = {
  storage,
  cloudinary,
};
