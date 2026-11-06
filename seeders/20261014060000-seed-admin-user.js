'use strict';
const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    const email = 'admin@gmail.com';
    const now = new Date();

    // Create admin user if not exists
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email = :email LIMIT 1`,
      { replacements: { email } }
    );
    let userId = existing[0] && existing[0].id;
    if (!userId) {
      const password = await bcrypt.hash('admin123', 10);
      const [inserted] = await queryInterface.sequelize.query(
        `INSERT INTO "Users"("firstName","lastName",email,password,status,"createdAt","updatedAt")
         VALUES ('Super','Admin',:email,:password,true,:now,:now) RETURNING id`,
        { replacements: { email, password, now } }
      );
      userId = inserted[0].id;
    }

    // Link to superadmin + admin + user roles (skip if already linked)
    await queryInterface.sequelize.query(
      `INSERT INTO "UserRoles"("userId","roleId","createdAt","updatedAt")
       SELECT :userId, r.id, :now, :now FROM "Roles" r
       WHERE r.code IN ('superadmin','admin','user')
         AND NOT EXISTS (SELECT 1 FROM "UserRoles" ur WHERE ur."userId" = :userId AND ur."roleId" = r.id)`,
      { replacements: { userId, now } }
    );
  },

  async down (queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "UserRoles" WHERE "userId" IN (SELECT id FROM "Users" WHERE email = 'admin@gmail.com')`
    );
    await queryInterface.bulkDelete('Users', { email: 'admin@gmail.com' });
  }
};
