'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Payments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull:false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull:false,
        references: { model: 'Orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      paywayTranId: {
        type: Sequelize.STRING(20), // PayWay tran_id max 20 chars
        allowNull:true,
        unique:true
      },
      method: {
        type: Sequelize.STRING,
        allowNull:false,
        defaultValue:"PENDING" // becomes abapay_khqr / cards / ... once known
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull:true
      },
      remark: {
        type: Sequelize.TEXT,
        allowNull:true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull:false
      },
      status: {
        type: Sequelize.STRING,
        allowNull:false,
        defaultValue:"pending"
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    await queryInterface.addIndex('Payments', ['orderId'], { name: 'payments_order_id' });
    await queryInterface.addIndex('Payments', ['userId'], { name: 'payments_user_id' });
    await queryInterface.addConstraint('Payments', {
      fields: ['status'],
      type: 'check',
      where: { status: ['pending', 'success', 'failed'] },
      name: 'payments_status_check'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Payments');
  }
};