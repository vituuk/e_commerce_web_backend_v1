const express = require("express");
require("dotenv").config();
const app = express();
const { Sequelize} = require("sequelize");
const PORT = process.env.PORT || 3000;

const productRoutes = require("./src/routes/product");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/swagger");
app.use(cors());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(express.json());
app.use("/uploads", express.static(require("path").join(__dirname, "src", "storage")));
const authRoutes = require("./src/routes/auth");
const userProfileRoutes = require("./src/routes/user-profile");
app.use("/product/:productId/images", require("./src/routes/product-image"));
app.use("/product/:productId/variants", require("./src/routes/product-variant"));
app.use("/product/:productId/reviews", require("./src/routes/review"));
app.use("/product", productRoutes);
app.use("/category", require("./src/routes/category"));
app.use("/cart", require("./src/routes/cart"));
app.use("/address", require("./src/routes/address"));
app.use("/order", require("./src/routes/order"));
app.use("/payment", require("./src/routes/payment"));
app.use("/auth", authRoutes);
app.use("/auth", userProfileRoutes);
app.use("/role", require("./src/routes/role"));
app.use("/user-role", require("./src/routes/user-role"));
app.use("/telegram", require("./src/routes/telegram"));
app.use("/email", require("./src/routes/email"));
//connect with neon 
const sequelize = new Sequelize(process.env.DATABASE_URL,{ 
    dialect: "postgres",
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('🚀 Successfully connected to Neon PostgreSQL!');
    
    // Sync database models (creates tables if they don't exist)
    await sequelize.sync();
    await sequelize.query('ALTER TABLE "UserProfiles" ALTER COLUMN "avatar" TYPE TEXT;').catch(() => {});
    await sequelize.query('ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;').catch(() => {});
    await sequelize.query('ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;').catch(() => {});

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
} 

app.get("/testing",(req,res)=>{
    res.json({message:"Hello from the server!"});
});

startServer();
