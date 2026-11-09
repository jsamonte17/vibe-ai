import {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import {
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript';
import { ChatConversation } from './chat-conversation.model';

export type ChatMessageRole = 'user' | 'assistant';
export type ChatMessageStatus = 'complete' | 'streaming' | 'failed';

@Table({
  tableName: 'ChatMessages',
  timestamps: true,
})
export class ChatMessage extends Model<
  InferAttributes<ChatMessage>,
  InferCreationAttributes<ChatMessage>
> {
  @PrimaryKey
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
  })
  declare id: CreationOptional<number>;

  @ForeignKey(() => ChatConversation)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare conversationId: number;

  @BelongsTo(() => ChatConversation)
  declare conversation?: NonAttribute<ChatConversation>;

  @Column({
    type: DataType.ENUM('user', 'assistant'),
    allowNull: false,
  })
  declare role: ChatMessageRole;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare content: string;

  @Column({
    type: DataType.ENUM('complete', 'streaming', 'failed'),
    allowNull: false,
    defaultValue: 'complete',
  })
  declare status: ChatMessageStatus;

  @CreatedAt
  declare createdAt: CreationOptional<Date>;

  @UpdatedAt
  declare updatedAt: CreationOptional<Date>;
}
