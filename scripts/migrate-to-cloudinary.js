const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");
const { ProductImage, UserProfile, sequelize } = require("../models");
const { uploadToCloudinary, isConfigured } = require("../src/utils/cloudinary");

const TARGET_FOLDER = "e-commerce-web-v1";

async function migrate() {
  if (!isConfigured) {
    console.error("❌ Cloudinary is not configured in admin/.env!");
    console.error(
      "Please set CLOUD_NAME, CLOUDINARY_KEY, and CLOUDINARY_SECRET in admin/.env"
    );
    process.exit(1);
  }

  const storageDir = path.join(__dirname, "..", "src", "storage", "products");

  console.log(`🚀 Starting migration of local images to Cloudinary folder "${TARGET_FOLDER}"...`);
  await sequelize.authenticate();
  console.log("✅ Connected to Neon PostgreSQL.");

  // Ensure new ProductImages columns exist before saving
  await sequelize.query('ALTER TABLE "ProductImages" ALTER COLUMN "url" TYPE TEXT;').catch(() => {});
  await sequelize.query('ALTER TABLE "ProductImages" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;').catch(() => {});
  await sequelize.query('ALTER TABLE "ProductImages" ADD COLUMN IF NOT EXISTS "fileName" VARCHAR(255);').catch(() => {});
  await sequelize.query('ALTER TABLE "ProductImages" ADD COLUMN IF NOT EXISTS "publicId" VARCHAR(255);').catch(() => {});

  // 1. Migrate ProductImages
  const images = await ProductImage.findAll({ order: [["id", "ASC"]] });
  let migratedCount = 0;
  let skippedCount = 0;

  for (const img of images) {
    const rawUrl = img.imageUrl || img.url || "";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      if (!img.imageUrl) {
        img.imageUrl = rawUrl;
        await img.save();
      }
      skippedCount++;
      continue;
    }

    const filename = path.basename(rawUrl);
    const localFilePath = path.join(storageDir, filename);

    if (fs.existsSync(localFilePath)) {
      try {
        console.log(`Uploading [${img.id}]: ${filename}...`);
        const result = await uploadToCloudinary(localFilePath, TARGET_FOLDER);
        if (result?.secure_url) {
          img.url = result.secure_url;
          img.imageUrl = result.secure_url;
          img.fileName = filename;
          img.publicId = result.public_id;
          await img.save();
          console.log(`  -> Migrated to: ${result.secure_url}`);
          migratedCount++;
        }
      } catch (err) {
        console.error(`  ❌ Failed to upload ${filename}:`, err.message);
      }
    } else {
      console.warn(`  ⚠️ Local file not found: ${localFilePath}`);
    }
  }

  // 2. Migrate UserProfiles avatars
  try {
    const profiles = await UserProfile.findAll();
    for (const prof of profiles) {
      const avatar = prof.avatar || "";
      if (avatar.startsWith("/uploads/products/")) {
        const filename = path.basename(avatar);
        const localFilePath = path.join(storageDir, filename);
        if (fs.existsSync(localFilePath)) {
          const result = await uploadToCloudinary(localFilePath, TARGET_FOLDER);
          if (result?.secure_url) {
            prof.avatar = result.secure_url;
            await prof.save();
            console.log(`  -> Migrated avatar for user ${prof.userId} to: ${result.secure_url}`);
            migratedCount++;
          }
        }
      }
    }
  } catch {
    // Ignore if UserProfiles table doesn't have avatars
  }

  console.log(`\n🎉 Migration Complete!`);
  console.log(`- Migrated to Cloudinary (${TARGET_FOLDER}): ${migratedCount}`);
  console.log(`- Already on Cloud (skipped): ${skippedCount}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
