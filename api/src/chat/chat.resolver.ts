import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenPayload } from '../auth/auth.types';
import { ChatService } from './chat.service';
import {
  ChatConversationResult,
  ChatMessageResult,
  ChatUpdatePayload,
  SendChatMessageInput,
} from './chat.types';

interface AuthenticatedGraphqlContext {
  user?: AuthTokenPayload;
  req?: { user?: AuthTokenPayload };
}

@Resolver()
@UseGuards(AuthGuard)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Query('chatConversations')
  chatConversations(
    @Context() context: AuthenticatedGraphqlContext,
  ): Promise<ChatConversationResult[]> {
    return this.chatService.listConversations(this.employeeId(context));
  }

  @Query('chatMessages')
  chatMessages(
    @Args('conversationId') conversationId: string,
    @Context() context: AuthenticatedGraphqlContext,
  ): Promise<ChatMessageResult[]> {
    return this.chatService.listMessages(
      this.employeeId(context),
      conversationId,
    );
  }

  @Mutation('createChatConversation')
  createChatConversation(
    @Context() context: AuthenticatedGraphqlContext,
  ): Promise<ChatConversationResult> {
    return this.chatService.createConversation(this.employeeId(context));
  }

  @Mutation('sendChatMessage')
  sendChatMessage(
    @Args('input') input: SendChatMessageInput,
    @Context() context: AuthenticatedGraphqlContext,
  ): Promise<ChatMessageResult> {
    return this.chatService.sendMessage(
      this.employeeId(context),
      input,
      this.username(context),
    );
  }

  @Subscription('chatUpdate')
  chatUpdate(
    @Context() context: AuthenticatedGraphqlContext,
  ): Promise<AsyncIterable<ChatUpdatePayload>> {
    return this.chatService.subscribeToUpdates(this.employeeId(context));
  }

  private employeeId(context: AuthenticatedGraphqlContext): string {
    const employeeId = context.user?.empid ?? context.req?.user?.empid;
    if (!employeeId) {
      throw new Error('Authenticated employee identity is missing.');
    }
    return employeeId;
  }

  private username(context: AuthenticatedGraphqlContext): string {
    const username = context.user?.username ?? context.req?.user?.username;
    if (!username) {
      throw new Error('Authenticated username is missing.');
    }
    return username;
  }
}
