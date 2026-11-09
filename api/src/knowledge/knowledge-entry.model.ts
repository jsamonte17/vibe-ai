import {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import {
  BelongsToMany,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { KnowledgeEntryTag } from './knowledge-entry-tag.model';
import { KnowledgeTag } from './knowledge-tag.model';

@Table({
  tableName: 'KnowledgeEntries',
  timestamps: true,
})
export class KnowledgeEntry extends Model<
  InferAttributes<KnowledgeEntry>,
  InferCreationAttributes<KnowledgeEntry>
> {
  @PrimaryKey
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
  })
  declare id: CreationOptional<number>;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare content: string;

  @BelongsToMany(() => KnowledgeTag, () => KnowledgeEntryTag)
  declare tags: NonAttribute<KnowledgeTag[]>;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
