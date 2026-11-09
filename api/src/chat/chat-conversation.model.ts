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
  tableName: 'ChatConversations',
  timestamps: true,
})
export class ChatConversation extends Model<
  InferAttributes<ChatConversation>,
  InferCreationAttributes<ChatConversation>
> {
  @PrimaryKey
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
  })
  declare id: CreationOptional<number>;

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare employeeId: string;

  @Column({
    type: DataType.STRING(200),
    allowNull: false,
    defaultValue: 'New chat',
  })
  declare title: string;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
