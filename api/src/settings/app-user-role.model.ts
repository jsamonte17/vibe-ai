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
} from 'sequelize-typescript';

@Table({
  tableName: 'AppUserRoles',
  timestamps: true,
  updatedAt: false,
})
export class AppUserRole extends Model<
  InferAttributes<AppUserRole>,
  InferCreationAttributes<AppUserRole>
> {
  @PrimaryKey
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare username: string;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'admin',
  })
  declare role: string;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;
}
