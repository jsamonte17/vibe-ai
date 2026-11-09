import {
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { KnowledgeEntry } from './knowledge-entry.model';
import { KnowledgeTag } from './knowledge-tag.model';

@Table({
  tableName: 'KnowledgeEntryTags',
  timestamps: false,
})
export class KnowledgeEntryTag extends Model {
  @ForeignKey(() => KnowledgeEntry)
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
  })
  declare knowledgeEntryId: number;

  @ForeignKey(() => KnowledgeTag)
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
  })
  declare knowledgeTagId: number;
}
