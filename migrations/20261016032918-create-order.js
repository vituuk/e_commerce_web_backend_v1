'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT' // keep order history: can't delete a user who has orders
      },
      addressId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Addresses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      order_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      shipping_receiver_name: { type: Sequelize.STRING, allowNull: false },
      shipping_phone: { type: Sequelize.STRING, allowNull: false },
      shipping_street: { type: Sequelize.STRING, allowNull: false },
      shipping_city: { type: Sequelize.STRING, allowNull: false },
      sub_total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      discount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      shipping_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending'
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
    await queryInterface.addIndex('Orders', ['userId'], { name: 'orders_user_id' });
    await queryInterface.addIndex('Orders', ['status'], { name: 'orders_status' });
    await queryInterface.addConstraint('Orders', {
      fields: ['status'],
      type: 'check',
      where: { status: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] },
      name: 'orders_status_check'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Orders');
  }
};