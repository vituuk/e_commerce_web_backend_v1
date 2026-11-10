const { cloudinary, storage } = require("../storage/storage");

function getCloudinaryConfig() {
  const cloud_name = process.env.CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_API_SECRET;
  const configured = Boolean(cloud_name && api_key && api_secret);
  if (configured) {
    cloudinary.config({ cloud_name, api_key, api_secret });
  }
  return { configured, cloud_name, api_key };
}

async function uploadToCloudinary(filePath, folder = "e-commerce-web-v1") {
  const { configured, cloud_name } = getCloudinaryConfig();
  if (!configured) {
    console.warn(
      "⚠️ [CLOUDINARY] Missing credentials in environment variables!",
    );
    return null;
  }
  console.log(`🚀 [CLOUDINARY] Uploading "${filePath}" to cloud "${cloud_name}" (${folder})...`);
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "auto",
  });
  console.log(`✅ [CLOUDINARY] Upload success: ${result.secure_url}`);
  return result;
}

module.exports = {
  cloudinary,
  storage,
  get isConfigured() {
    return getCloudinaryConfig().configured;
  },
  uploadToCloudinary,
};
