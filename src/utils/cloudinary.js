require("dotenv").config();
const cloudinary = require("cloudinary").v2;

function getCloudinaryConfig() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  const configured = Boolean(cloud_name && api_key && api_secret);
  if (configured) {
    cloudinary.config({ cloud_name, api_key, api_secret });
  }
  return { configured, cloud_name, api_key };
}

/**
 * Uploads a local file path to Cloudinary
 * @param {string} filePath - Absolute path on disk
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<string|null>} - Returns secure_url or null if not configured
 */
async function uploadToCloudinary(filePath, folder = "e-commerce-products") {
  const { configured, cloud_name } = getCloudinaryConfig();
  if (!configured) {
    console.warn("⚠️ [CLOUDINARY] Missing credentials in environment variables!");
    return null;
  }
  console.log(`🚀 [CLOUDINARY] Uploading "${filePath}" to cloud "${cloud_name}"...`);
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
  });
  console.log(`✅ [CLOUDINARY] Upload success: ${result.secure_url}`);
  return result.secure_url;
}

module.exports = {
  cloudinary,
  get isConfigured() {
    return Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  },
  uploadToCloudinary,
};
