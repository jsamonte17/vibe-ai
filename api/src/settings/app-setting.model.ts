import {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'AppSettings',
  timestamps: true,
  createdAt: false,
})
export class AppSetting extends Model<
  InferAttributes<AppSetting>,
  InferCreationAttributes<AppSetting>
> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare key: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare value: string;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
