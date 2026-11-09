import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PubSub } from 'graphql-subscriptions';
import { AuthModule } from '../auth/auth.module';
import { BrainModule } from '../brain/brain.module';
import { ChatConversation } from './chat-conversation.model';
import { ChatMessage } from './chat-message.model';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';

@Module({
  imports: [
    AuthModule,
    BrainModule,
    SequelizeModule.forFeature([ChatConversation, ChatMessage]),
  ],
  providers: [
    ChatResolver,
    ChatService,
    {
      provide: PubSub,
      useValue: new PubSub(),
    },
  ],
})
export class ChatModule {}
