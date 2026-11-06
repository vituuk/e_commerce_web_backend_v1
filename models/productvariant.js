'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductVariant extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductVariant.belongsTo(models.Product,{
        foreignKey:"productId",
        as:"product"
      })
    }
  }
  ProductVariant.init({
    productId: { type: DataTypes.INTEGER, allowNull: false },
    sku: { type: DataTypes.STRING, allowNull: false, unique: true },
    color: DataTypes.STRING,
    size: DataTypes.STRING,
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // null = use product base_price
    stock_qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    sequelize,
    modelName: 'ProductVariant',
  });
  return ProductVariant;
};