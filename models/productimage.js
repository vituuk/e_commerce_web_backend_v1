'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductImage extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductImage.belongsTo(models.Product,{
        foreignKey:"productId",
        as:"product"
      })
    }
  }
  ProductImage.init({
    productId: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false }
  }, {
    sequelize,
    modelName: 'ProductImage',
  });
  return ProductImage;
};