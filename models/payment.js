'use strict';
const {
  Model
} = require('sequelize');

const PAYMENT_STATUSES = ["pending", "success", "failed"];

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Payment.belongsTo(models.User, { foreignKey: "userId", as: "user" });
      Payment.belongsTo(models.Order, { foreignKey: "orderId", as: "order" });
    }
  }
  Payment.init({
    userId: { type: DataTypes.INTEGER, allowNull: false },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    paywayTranId: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    method: { type: DataTypes.STRING, allowNull: false, defaultValue: "PENDING" },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    remark: { type: DataTypes.TEXT, allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: { isIn: [PAYMENT_STATUSES] }
    }
  }, {
    sequelize,
    modelName: 'Payment',
  });
  Payment.STATUSES = PAYMENT_STATUSES;
  return Payment;
};