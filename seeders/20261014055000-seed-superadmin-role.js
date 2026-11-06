'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    // Add "superadmin" role only if it doesn't exist yet
    await queryInterface.sequelize.query(
      `INSERT INTO "Roles"(name, code, status, "createdAt", "updatedAt")
       SELECT 'Super Admin', 'superadmin', true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "Roles" WHERE code = 'superadmin')`
    );
  },

  async down (queryInterface) {
    await queryInterface.bulkDelete('Roles', { code: 'superadmin' });
  }
};
