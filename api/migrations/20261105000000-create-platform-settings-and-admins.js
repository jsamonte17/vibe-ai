'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'AppSettings',
        {
          key: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING(64),
          },
          value: {
            allowNull: false,
            type: Sequelize.TEXT,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        'AppUserRoles',
        {
          username: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING(100),
          },
          role: {
            allowNull: false,
            type: Sequelize.STRING(16),
            defaultValue: 'admin',
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );

      const administrators = [
        ...new Set(
          (process.env.ADMIN_USERNAMES || '')
            .split(',')
            .map((username) => username.trim().toLocaleLowerCase())
            .filter(Boolean),
        ),
      ];
      if (!administrators.length) {
        throw new Error(
          'Set ADMIN_USERNAMES to bootstrap at least one administrator.',
        );
      }

      await queryInterface.bulkInsert(
        'AppUserRoles',
        administrators.map((username) => ({
          username,
          role: 'admin',
          createdAt: new Date(),
        })),
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AppUserRoles');
    await queryInterface.dropTable('AppSettings');
  },
};
