'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'BrainDatabaseReferences',
        {
          tableName: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING(63),
          },
          description: {
            allowNull: false,
            type: Sequelize.TEXT,
          },
          columns: {
            allowNull: false,
            type: Sequelize.JSONB,
          },
          relationships: {
            allowNull: false,
            type: Sequelize.TEXT,
            defaultValue: '',
          },
          enabled: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: true,
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

      await queryInterface.bulkInsert(
        'BrainDatabaseReferences',
        [
          {
            tableName: 'KnowledgeEntries',
            description: 'Approved company knowledge entries, including company profile facts and resolved issue explanations.',
            columns: JSON.stringify([
              'id',
              'title',
              'content',
              'createdAt',
              'updatedAt',
            ]),
            relationships: 'Join KnowledgeEntryTags.knowledgeEntryId to KnowledgeEntries.id, then KnowledgeTags.id to KnowledgeEntryTags.knowledgeTagId.',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            tableName: 'KnowledgeTags',
            description: 'Labels used to group company knowledge entries.',
            columns: JSON.stringify([
              'id',
              'name',
              'normalizedName',
              'createdAt',
              'updatedAt',
            ]),
            relationships: 'Join KnowledgeEntryTags.knowledgeTagId to KnowledgeTags.id, then KnowledgeEntries.id to KnowledgeEntryTags.knowledgeEntryId.',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            tableName: 'KnowledgeEntryTags',
            description: 'Junction rows linking knowledge entries to tags.',
            columns: JSON.stringify(['knowledgeEntryId', 'knowledgeTagId']),
            relationships: 'knowledgeEntryId references KnowledgeEntries.id; knowledgeTagId references KnowledgeTags.id.',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('BrainDatabaseReferences');
  },
};
