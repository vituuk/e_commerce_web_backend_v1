require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const path = require("path");
const fs = require("fs");
const { ProductImage, UserProfile, sequelize } = require("../models");
const { uploadToCloudinary, isConfigured } = require("../src/utils/cloudinary");

async function migrate() {
  if (!isConfigured) {
    console.error("❌ Cloudinary is not configured in .env!");
    console.error("Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in admin/.env");
    process.exit(1);
  }

  const storageDir = path.join(__dirname, "..", "src", "storage", "products");

  console.log("🚀 Starting migration of local images to Cloudinary...");
  await sequelize.authenticate();
  console.log(" Connected to Neon PostgreSQL.");

  // 1. Migrate ProductImages
  const images = await ProductImage.findAll();
  let migratedCount = 0;
  let skippedCount = 0;

  for (const img of images) {
    const rawUrl = img.url || "";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      skippedCount++;
      continue;
    }

    const filename = path.basename(rawUrl);
    const localFilePath = path.join(storageDir, filename);

    if (fs.existsSync(localFilePath)) {
      try {
        console.log(`Uploading [${img.id}]: ${filename}...`);
        const cloudUrl = await uploadToCloudinary(localFilePath, "ecommerce/products");
        if (cloudUrl) {
          img.url = cloudUrl;
          await img.save();
          console.log(`  -> Migrated to: ${cloudUrl}`);
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
          const cloudUrl = await uploadToCloudinary(localFilePath, "ecommerce/avatars");
          if (cloudUrl) {
            prof.avatar = cloudUrl;
            await prof.save();
            console.log(`  -> Migrated avatar for user ${prof.userId} to: ${cloudUrl}`);
            migratedCount++;
          }
        }
      }
    }
  } catch (err) {
    // Ignore if UserProfiles table doesn't have avatars
  }

  console.log(`\n🎉 Migration Complete!`);
  console.log(`- Migrated to Cloudinary: ${migratedCount}`);
  console.log(`- Already on Cloud (skipped): ${skippedCount}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

