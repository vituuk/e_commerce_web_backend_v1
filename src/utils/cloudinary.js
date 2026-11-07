const cloudinary = require("cloudinary").v2;

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a local file path to Cloudinary
 * @param {string} filePath - Absolute path on disk
 * @param {string} folder - Target folder in Cloudinary
 * @returns {Promise<string|null>} - Returns secure_url or null if not configured
 */
async function uploadToCloudinary(filePath, folder = "ecommerce/products") {
  if (!isConfigured) return null;
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
  });
  return result.secure_url;
}

module.exports = { cloudinary, isConfigured, uploadToCloudinary };

