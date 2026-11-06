'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    await queryInterface.bulkInsert('Roles', [
      { name: 'Admin', code: 'admin', status: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'User',  code: 'user',  status: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  async down (queryInterface) {
    await queryInterface.bulkDelete('Roles', { code: ['admin', 'user'] });
  }
};
