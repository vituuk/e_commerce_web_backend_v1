const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { storage, cloudinary } = require("../storage/storage");

const UPLOAD_DIR = path.join(__dirname, "..", "storage", "products");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Accepts multipart key "file" or "image" and populates req.file from CloudinaryStorage
const handleUpload = (req, res, next) => {
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File must be 10MB or smaller" });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      const raw = err?.error?.message || err?.message || String(err);
      const message =
        err?.http_code === 403 || String(raw).includes("403")
          ? "Cloudinary rejected upload with 403 Forbidden: API Key is missing 'create' (Upload) permission."
          : `Failed to upload file: ${raw}`;
      return res.status(err?.http_code === 403 ? 502 : 400).json({
        message,
        error: raw,
      });
    }
    if (!req.file && req.files) {
      req.file = req.files.file?.[0] || req.files.image?.[0] || undefined;
    }
    if (req.file && req.file.path) {
      req.file.cloudinaryUrl = req.file.path;
    }
    next();
  });
};

const deleteUploadedFile = async (urlOrPublicId) => {
  if (!urlOrPublicId) return;
  if (urlOrPublicId.startsWith("/uploads/products/")) {
    const file = path.join(UPLOAD_DIR, path.basename(urlOrPublicId));
    fs.unlink(file, () => {});
    return;
  }
  if (!urlOrPublicId.startsWith("http://") && !urlOrPublicId.startsWith("https://")) {
    await cloudinary.uploader.destroy(urlOrPublicId).catch(() => {});
  }
};

module.exports = {
  upload,
  handleUpload,
  deleteUploadedFile,
  UPLOAD_DIR,
};
