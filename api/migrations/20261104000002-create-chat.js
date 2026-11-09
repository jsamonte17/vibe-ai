'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'ChatConversations',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          employeeId: {
            allowNull: false,
            type: Sequelize.STRING(64),
          },
          title: {
            allowNull: false,
            type: Sequelize.STRING(200),
            defaultValue: 'New chat',
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );
      await queryInterface.addIndex('ChatConversations', ['employeeId', 'updatedAt'], {
        transaction,
      });

      await queryInterface.createTable(
        'ChatMessages',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          conversationId: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: { model: 'ChatConversations', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          role: {
            allowNull: false,
            type: Sequelize.ENUM('user', 'assistant'),
          },
          content: {
            allowNull: false,
            type: Sequelize.TEXT,
          },
          status: {
            allowNull: false,
            type: Sequelize.ENUM('complete', 'streaming', 'failed'),
            defaultValue: 'complete',
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction },
      );
      await queryInterface.addIndex('ChatMessages', ['conversationId', 'id'], {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('ChatMessages', { transaction });
      await queryInterface.dropTable('ChatConversations', { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_ChatMessages_role"',
        { transaction },
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_ChatMessages_status"',
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
