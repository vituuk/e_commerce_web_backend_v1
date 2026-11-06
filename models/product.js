'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Product.belongsTo(models.Category,{
        foreignKey:"categoryId",
        as:"category"
      })
      Product.hasMany(models.ProductImage,{
        foreignKey:"productId",
        as:"images"
      })
      Product.hasMany(models.ProductVariant,{
        foreignKey:"productId",
        as:"variants"
      })
    }
  }
  Product.init({
    categoryId: DataTypes.INTEGER,
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: DataTypes.TEXT,
    base_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    sequelize,
    modelName: 'Product',
  });
  return Product;
};