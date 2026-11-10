"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ProductImage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductImage.belongsTo(models.Product, {
        foreignKey: "productId",
        as: "product",
      });
    }
  }
  ProductImage.init({
    productId: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.TEXT, allowNull: true },
    fileName: { type: DataTypes.STRING, allowNull: true },
    publicId: { type: DataTypes.STRING, allowNull: true },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false }
  }, {
    sequelize,
    modelName: 'ProductImage',
    hooks: {
      beforeValidate(instance) {
        if (instance.imageUrl && !instance.url) {
          instance.url = instance.imageUrl;
        }
        if (instance.url && !instance.imageUrl) {
          instance.imageUrl = instance.url;
        }
      }
    }
  });
  return ProductImage;
};
