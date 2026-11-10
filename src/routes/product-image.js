const express = require("express");
const multer = require("multer");
const { Product, ProductImage, sequelize } = require("../../models");
const { storage, cloudinary } = require("../storage/storage");
const { authenticate, authorize } = require("../middleware/middleware");
const { deleteUploadedFile } = require("../middleware/upload");

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Accepts multipart key "file" (Postman) or "image" (Admin Dashboard) and populates req.file
const formatUploadError = (err) => {
  const raw = err?.error?.message || err?.message || String(err || "Unknown error");
  if (err?.http_code === 403 || String(raw).includes("403")) {
    return "Cloudinary rejected upload with 403 Forbidden: your API Key is missing 'create' (Upload) permission. In Cloudinary Console -> Settings -> API Keys, use your Root API Key or enable Upload/Create permissions, then update CLOUD_NAME / CLOUDINARY_KEY / CLOUDINARY_SECRET in .env and Render.";
  }
  return `Failed to upload image to Cloudinary: ${raw}`;
};

const uploadFile = (req, res, next) => {
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      const detailedMsg = formatUploadError(err);
      console.error("❌ Cloudinary upload error:", err);
      return res.status(err?.http_code === 403 ? 502 : 400).json({
        message: detailedMsg,
        error: err?.message || String(err),
      });
    }
    if (!req.file && req.files) {
      req.file = req.files.file?.[0] || req.files.image?.[0] || undefined;
    }
    next();
  });
};

const toBool = (v) => v === true || v === "true" || v === "1" || v === "yes";

const extractPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com/")) {
    return null;
  }
  const match = url.match(
    /\/(?:image|video|raw)\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:[?#].*)?$/i
  );
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

// 1. UPLOAD FILE TO CLOUDINARY ("e-commerce-web-v1") & SAVE TO DB
const handleUploadProductImage = async (req, res) => {
  const file = req.file;
  const directUrl = req.body?.url ? String(req.body.url).trim() : null;
  const productId = req.params.productId || req.params.id;

  if (!file && !directUrl) {
    return res.status(400).json({
      message:
        "No file uploaded! Please make sure your Postman key is exactly 'file' (or 'image') and a file is selected.",
    });
  }

  const t = await sequelize.transaction();
  try {
    const product = await Product.findByPk(productId, { transaction: t });

    if (!product) {
      await t.rollback();
      if (file?.filename) {
        await cloudinary.uploader.destroy(file.filename).catch(() => {});
      }
      return res.status(404).json({
        message: `Product id=${productId} not found`,
      });
    }

    const finalUrl = file ? file.path : directUrl;

    // First image becomes primary automatically
    const count = await ProductImage.count({
      where: { productId: product.id },
      transaction: t,
    });
    const primary = count === 0 ? true : toBool(req.body?.is_primary);

    // Only one primary per product
    if (primary) {
      await ProductImage.update(
        { is_primary: false },
        { where: { productId: product.id }, transaction: t }
      );
    }

    const saveImage = await ProductImage.create(
      {
        productId: product.id,
        url: finalUrl,
        imageUrl: finalUrl,
        fileName: file ? file.originalname : null,
        publicId: file ? file.filename : extractPublicIdFromUrl(finalUrl),
        is_primary: primary,
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({
      message: "Upload image successfully",
      data: saveImage,
    });
  } catch (error) {
    await t.rollback();
    if (file?.filename) {
      await cloudinary.uploader.destroy(file.filename).catch(() => {});
    }
    console.log("Upload product image error", error);
    return res.status(500).json({
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

// 2. DOWNLOAD / REDIRECT TO CLOUDINARY FILE
const handleDownloadProductImage = async (req, res) => {
  try {
    const imageId = req.params.imageId || req.params.id;
    const where = req.params.productId
      ? { id: imageId, productId: req.params.productId }
      : { id: imageId };
    const image = await ProductImage.findOne({ where });

    if (!image) {
      return res.status(404).json({
        message: `Product image id=${imageId} not found`,
      });
    }

    const sourceUrl = image.imageUrl || image.url;
    // Redirect to the Cloudinary URL (with fl_attachment to force download)
    const downloadUrl = sourceUrl.includes("/upload/")
      ? sourceUrl.replace("/upload/", "/upload/fl_attachment/")
      : sourceUrl;
    return res.redirect(downloadUrl);
  } catch (error) {
    console.log("Download product image error", error);
    return res.status(500).json({
      message: "Failed to download image",
      error: error.message,
    });
  }
};

// 3. DELETE FILE FROM CLOUDINARY & DATABASE
const handleDeleteProductImage = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const imageId = req.params.imageId || req.params.id;
    const where = req.params.productId
      ? { id: imageId, productId: req.params.productId }
      : { id: imageId };
    const image = await ProductImage.findOne({ where, transaction: t });

    if (!image) {
      await t.rollback();
      return res.status(404).json({
        message: `Image id=${imageId} not found`,
      });
    }

    const wasPrimary = image.is_primary;
    const targetProductId = image.productId;
    const oldUrl = image.imageUrl || image.url;
    const publicId = image.publicId || extractPublicIdFromUrl(oldUrl);

    await image.destroy({ transaction: t });

    // Promote another image if the primary was removed
    if (wasPrimary) {
      const next = await ProductImage.findOne({
        where: { productId: targetProductId },
        order: [["id", "ASC"]],
        transaction: t,
      });
      if (next) {
        next.is_primary = true;
        await next.save({ transaction: t });
      }
    }

    await t.commit();

    if (publicId) {
      await cloudinary.uploader.destroy(publicId).catch((err) => {
        console.warn("Cloudinary destroy warning:", err.message || err);
      });
    } else if (oldUrl && oldUrl.startsWith("/uploads/products/")) {
      await deleteUploadedFile(oldUrl);
    }

    return res.status(200).json({
      message: "Image deleted successfully",
    });
  } catch (error) {
    await t.rollback();
    console.log("Delete product image error", error);
    return res.status(500).json({
      message: "Failed to delete image",
      error: error.message,
    });
  }
};

// ================= NESTED ROUTER (/product/:productId/images) =================
const router = express.Router({ mergeParams: true });

// GET /product/:productId/images : public, list images of a product
router.get("/", async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.productId, {
      attributes: ["id", "name", "slug"],
      include: [{ model: ProductImage, as: "images", attributes: { exclude: ["productId"] } }],
      order: [
        [{ model: ProductImage, as: "images" }, "is_primary", "DESC"],
        [{ model: ProductImage, as: "images" }, "id", "ASC"],
      ],
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ message: "Product images", data: product });
  } catch (error) {
    console.log("Get product images error", error);
    return res.status(500).json({ message: "Get product images failed" });
  }
});

// GET /product/:productId/images/:imageId/download : public, download Cloudinary file
router.get("/:imageId/download", handleDownloadProductImage);

// GET /product/:productId/images/:id : public, one image with its product
router.get("/:id", async (req, res) => {
  try {
    const image = await ProductImage.findOne({
      where: { id: req.params.id, productId: req.params.productId },
      include: [{ model: Product, as: "product", attributes: ["id", "name", "slug"] }],
    });
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }
    return res.status(200).json({ message: "Product image", data: image });
  } catch (error) {
    console.log("Get product image error", error);
    return res.status(500).json({ message: "Get product image failed" });
  }
});

// POST /product/:productId/images (& /upload) : admin only, upload to Cloudinary ("e-commerce-web-v1")
router.post("/", authenticate, authorize("admin"), uploadFile, handleUploadProductImage);
router.post("/upload", authenticate, authorize("admin"), uploadFile, handleUploadProductImage);

// PUT /product/:productId/images/:id : admin only, update/replace image on Cloudinary ("e-commerce-web-v1")
router.put("/:id", authenticate, authorize("admin"), uploadFile, async (req, res) => {
  const file = req.file;
  const directUrl = req.body?.url ? String(req.body.url).trim() : null;
  const newUrl = file ? file.path : directUrl;
  const rawProductId = req.body?.productId ?? req.body?.product_id;

  const t = await sequelize.transaction();
  try {
    let image = await ProductImage.findOne({
      where: { id: req.params.id, productId: req.params.productId },
      transaction: t,
    });
    if (
      !image &&
      rawProductId !== undefined &&
      String(rawProductId).trim() === String(req.params.productId)
    ) {
      image = await ProductImage.findByPk(req.params.id, { transaction: t });
    }
    if (!image) {
      await t.rollback();
      if (file?.filename) {
        await cloudinary.uploader.destroy(file.filename).catch(() => {});
      }
      return res.status(404).json({ message: "Image not found" });
    }

    const oldProductId = Number(image.productId);
    const wasPrimaryOnOld = Boolean(image.is_primary);
    let targetProductId = oldProductId;

    if (rawProductId !== undefined && String(rawProductId).trim() !== "") {
      const parsedProductId = Number(rawProductId);
      if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
        await t.rollback();
        if (file?.filename) {
          await cloudinary.uploader.destroy(file.filename).catch(() => {});
        }
        return res.status(400).json({ message: "Invalid productId" });
      }
      if (parsedProductId !== oldProductId) {
        const targetProduct = await Product.findByPk(parsedProductId, { transaction: t });
        if (!targetProduct) {
          await t.rollback();
          if (file?.filename) {
            await cloudinary.uploader.destroy(file.filename).catch(() => {});
          }
          return res.status(404).json({ message: "Product not found" });
        }
        targetProductId = targetProduct.id;
        image.productId = targetProductId;
      }
    }

    const oldUrl = image.imageUrl || image.url;
    const oldPublicId = image.publicId || extractPublicIdFromUrl(oldUrl);

    if (newUrl) {
      image.url = newUrl;
      image.imageUrl = newUrl;
      if (file) {
        image.fileName = file.originalname;
        image.publicId = file.filename;
      } else {
        image.publicId = extractPublicIdFromUrl(newUrl);
      }
    }

    if (req.body?.is_primary !== undefined && String(req.body.is_primary).trim() !== "") {
      if (toBool(req.body.is_primary)) {
        await ProductImage.update(
          { is_primary: false },
          { where: { productId: targetProductId }, transaction: t }
        );
        image.is_primary = true;
      } else {
        image.is_primary = false;
      }
    } else if (targetProductId !== oldProductId) {
      if (image.is_primary) {
        await ProductImage.update(
          { is_primary: false },
          { where: { productId: targetProductId }, transaction: t }
        );
      } else {
        const targetCount = await ProductImage.count({
          where: { productId: targetProductId },
          transaction: t,
        });
        if (targetCount === 0) image.is_primary = true;
      }
    }

    await image.save({ transaction: t });

    // Promote another image on the old product if its primary image was moved
    if (targetProductId !== oldProductId && wasPrimaryOnOld) {
      const next = await ProductImage.findOne({
        where: { productId: oldProductId },
        order: [["id", "ASC"]],
        transaction: t,
      });
      if (next) {
        next.is_primary = true;
        await next.save({ transaction: t });
      }
    }

    await t.commit();

    // Remove replaced Cloudinary asset (or legacy local file)
    if (file && oldUrl && oldUrl !== newUrl) {
      if (oldPublicId && oldPublicId !== file.filename) {
        await cloudinary.uploader.destroy(oldPublicId).catch(() => {});
      } else if (oldUrl.startsWith("/uploads/products/")) {
        await deleteUploadedFile(oldUrl);
      }
    }

    return res.status(200).json({ message: "Image updated", data: image });
  } catch (error) {
    await t.rollback();
    if (file?.filename) {
      await cloudinary.uploader.destroy(file.filename).catch(() => {});
    }
    console.log("Update product image error", error);
    return res.status(500).json({
      message: "Update product image failed",
      error: error.message,
    });
  }
});

// DELETE /product/:productId/images/:imageId : admin only, delete from Cloudinary & DB
router.delete("/:imageId", authenticate, authorize("admin"), handleDeleteProductImage);

// ================= DIRECT ROUTER (/product) =================
// 1. POST   /product/:id/upload
// 2. GET    /product/images/:imageId/download
// 3. DELETE /product/images/:imageId
const directProductImageRouter = express.Router();

directProductImageRouter.post(
  "/:id/upload",
  authenticate,
  authorize("admin"),
  uploadFile,
  handleUploadProductImage
);
directProductImageRouter.get("/images/:imageId/download", handleDownloadProductImage);
directProductImageRouter.delete(
  "/images/:imageId",
  authenticate,
  authorize("admin"),
  handleDeleteProductImage
);

router.directProductImageRouter = directProductImageRouter;
module.exports = router;
