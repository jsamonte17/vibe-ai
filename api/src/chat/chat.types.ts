import { ChatMessageRole, ChatMessageStatus } from './chat-message.model';

export interface ChatMessageResult {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  createdAt: string;
}

export interface ChatConversationResult {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatUpdate extends ChatMessageResult {
  delta: string;
}

export interface ChatUpdatePayload {
  chatUpdate: ChatUpdate;
}

export interface SendChatMessageInput {
  conversationId?: string;
  content: string;
}
