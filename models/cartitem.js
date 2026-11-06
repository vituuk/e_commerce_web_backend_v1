'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CartItem extends Model {
    static associate(models) {
      CartItem.belongsTo(models.Cart, { foreignKey: "cartId", as: "cart" });
      CartItem.belongsTo(models.ProductVariant, { foreignKey: "variantId", as: "variant" });
    }
  }
  CartItem.init({
    cartId: { type: DataTypes.INTEGER, allowNull: false },
    variantId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  }, {
    sequelize,
    modelName: 'CartItem',
    indexes: [{ unique: true, fields: ["cartId", "variantId"] }]
  });
  return CartItem;
};
