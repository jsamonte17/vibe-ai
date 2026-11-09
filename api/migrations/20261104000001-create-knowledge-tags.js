'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'KnowledgeTags',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          name: {
            allowNull: false,
            type: Sequelize.STRING(64),
          },
          normalizedName: {
            allowNull: false,
            unique: true,
            type: Sequelize.STRING(64),
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

      await queryInterface.createTable(
        'KnowledgeEntryTags',
        {
          knowledgeEntryId: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.INTEGER,
            references: { model: 'KnowledgeEntries', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          knowledgeTagId: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.INTEGER,
            references: { model: 'KnowledgeTags', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('KnowledgeEntryTags', { transaction });
      await queryInterface.dropTable('KnowledgeTags', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
