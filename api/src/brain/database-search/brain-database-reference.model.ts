import {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'BrainDatabaseReferences',
  timestamps: true,
})
export class BrainDatabaseReference extends Model<
  InferAttributes<BrainDatabaseReference>,
  InferCreationAttributes<BrainDatabaseReference>
> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(63),
    allowNull: false,
  })
  declare tableName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare description: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  declare columns: string[];

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    defaultValue: '',
  })
  declare relationships: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare enabled: boolean;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
