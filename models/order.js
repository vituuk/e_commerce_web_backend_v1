'use strict';
const {
  Model
} = require('sequelize');

const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Order.belongsTo(models.User, { foreignKey: "userId", as: "user" });
      Order.belongsTo(models.Address, { foreignKey: "addressId", as: "address" });
      Order.hasMany(models.OrderItem, { foreignKey: "orderId", as: "items", onDelete: "CASCADE" });
    }
  }
  Order.init({
    userId: { type: DataTypes.INTEGER, allowNull: false },
    addressId: { type: DataTypes.INTEGER, allowNull: true }, // null if the address is deleted later
    order_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    // shipping snapshot: copied from the address at checkout
    shipping_receiver_name: { type: DataTypes.STRING, allowNull: false },
    shipping_phone: { type: DataTypes.STRING, allowNull: false },
    shipping_street: { type: DataTypes.STRING, allowNull: false },
    shipping_city: { type: DataTypes.STRING, allowNull: false },
    sub_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    shipping_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: { isIn: [ORDER_STATUSES] }
    }
  }, {
    sequelize,
    modelName: 'Order',
  });
  Order.STATUSES = ORDER_STATUSES;
  return Order;
};