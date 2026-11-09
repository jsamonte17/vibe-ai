import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import {
  Alert,
  Button,
  Input,
  List,
  Spin,
  Tag,
  Typography,
} from 'antd';

const { Paragraph, Text, Title } = Typography;

const CHAT_CONVERSATIONS = gql`
  query ChatConversations {
    chatConversations {
      id
      title
      updatedAt
    }
  }
`;

const CHAT_MESSAGES = gql`
  query ChatMessages($conversationId: ID!) {
    chatMessages(conversationId: $conversationId) {
      id
      conversationId
      role
      content
      status
      createdAt
    }
  }
`;

const CHAT_UPDATES = gql`
  subscription ChatUpdate {
    chatUpdate {
      id
      conversationId
      role
      content
      delta
      status
      createdAt
    }
  }
`;

const CREATE_CONVERSATION = gql`
  mutation CreateChatConversation {
    createChatConversation {
      id
      title
      updatedAt
    }
  }
`;

const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($input: SendChatMessageInput!) {
    sendChatMessage(input: $input) {
      id
      conversationId
      role
      content
      status
      createdAt
    }
  }
`;

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'complete' | 'streaming' | 'failed';
  createdAt: string;
}

interface ChatUpdate extends ChatMessage {
  delta: string;
}

interface ChatConversationsData {
  chatConversations: Conversation[];
}

interface CreateConversationData {
  createChatConversation: Conversation;
}

interface SendChatMessageData {
  sendChatMessage: ChatMessage;
}

interface SendChatMessageVariables {
  input: {
    conversationId: string;
    content: string;
  };
}

interface ChatMessagesData {
  chatMessages: ChatMessage[];
}

interface ChatUpdateData {
  chatUpdate: ChatUpdate;
}

interface ChatPageProps {
  onLogout: () => void;
  isAdmin: boolean;
  onSettings: () => void;
}

export function ChatPage({ onLogout, isAdmin, onSettings }: ChatPageProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >();
  const [draft, setDraft] = useState('');
  const [liveMessages, setLiveMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const messageEndRef = useRef<HTMLDivElement>(null);

  const conversationsResult = useQuery<ChatConversationsData>(
    CHAT_CONVERSATIONS,
    { fetchPolicy: 'cache-and-network' },
  );
  const { refetch: refetchConversations } = conversationsResult;
  const messagesResult = useQuery<ChatMessagesData>(CHAT_MESSAGES, {
    variables: { conversationId: selectedConversationId ?? '' },
    skip: !selectedConversationId,
    fetchPolicy: 'cache-and-network',
  });
  const [createConversation, createResult] =
    useMutation<CreateConversationData>(CREATE_CONVERSATION);
  const [sendMessage, sendResult] = useMutation<
    SendChatMessageData,
    SendChatMessageVariables
  >(SEND_CHAT_MESSAGE);
  const subscriptionResult = useSubscription<ChatUpdateData>(CHAT_UPDATES);

  const conversations = conversationsResult.data?.chatConversations ?? [];
  const activeConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  );
  const savedMessages =
    messagesResult.data?.chatMessages?.filter(
      (message) => message.conversationId === selectedConversationId,
    ) ?? [];
  const messages = useMemo(() => {
    const merged = new Map<string, ChatMessage>();
    for (const message of savedMessages) {
      merged.set(message.id, message);
    }
    for (const message of liveMessages[selectedConversationId ?? ''] ?? []) {
      merged.set(message.id, message);
    }
    return [...merged.values()].sort(
      (left, right) => Number(left.id) - Number(right.id),
    );
  }, [liveMessages, savedMessages, selectedConversationId]);
  const assistantIsStreaming =
    sending ||
    messages.some(
      (message) => message.role === 'assistant' && message.status === 'streaming',
    );

  useEffect(() => {
    if (!selectedConversationId && conversations.length) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const update = subscriptionResult.data?.chatUpdate;
    if (!update) {
      return;
    }

    setLiveMessages((current) => {
      const conversationMessages = current[update.conversationId] ?? [];
      const existing = conversationMessages.findIndex(
        (message) => message.id === update.id,
      );
      const nextMessage: ChatMessage = {
        id: update.id,
        conversationId: update.conversationId,
        role: update.role,
        content: update.content,
        status: update.status,
        createdAt: update.createdAt,
      };
      const updatedMessages =
        existing >= 0
          ? conversationMessages.map((message, index) =>
              index === existing ? nextMessage : message,
            )
          : [...conversationMessages, nextMessage];
      return {
        ...current,
        [update.conversationId]: updatedMessages,
      };
    });

    if (
      update.conversationId === selectedConversationId &&
      (update.status === 'complete' || update.status === 'failed')
    ) {
      setSending(false);
      void refetchConversations();
    }
  }, [subscriptionResult.data, refetchConversations, selectedConversationId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewConversation = async () => {
    setActionError(undefined);
    try {
      const result = await createConversation();
      if (result.errors?.length || !result.data?.createChatConversation) {
        throw new Error(
          result.errors?.map((error) => error.message).join(', ') ||
            'Could not create a conversation.',
        );
      }

      setSelectedConversationId(result.data.createChatConversation.id);
      void refetchConversations();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not create a conversation.',
      );
    }
  };

  const submitMessage = async () => {
    const content = draft.trim();
    if (!content || sending) {
      return;
    }

    setActionError(undefined);
    setSending(true);

    try {
      let conversationId = selectedConversationId;
      if (!conversationId) {
        const created = await createConversation();
        if (created.errors?.length || !created.data?.createChatConversation) {
          throw new Error(
            created.errors?.map((error) => error.message).join(', ') ||
              'Could not create a conversation.',
          );
        }
        conversationId = created.data.createChatConversation.id;
        setSelectedConversationId(conversationId);
      }

      const result = await sendMessage({
        variables: {
          input: { conversationId, content },
        },
      });
      if (result.errors?.length || !result.data?.sendChatMessage) {
        throw new Error(
          result.errors?.map((error) => error.message).join(', ') ||
            'Could not send your message.',
        );
      }

      const userMessage = result.data.sendChatMessage;
      setLiveMessages((current) => ({
        ...current,
        [conversationId]: [
          ...(current[conversationId] ?? []),
          userMessage,
        ],
      }));
      setDraft('');
      void refetchConversations();
    } catch (error) {
      setSending(false);
      setActionError(
        error instanceof Error ? error.message : 'Could not send your message.',
      );
    }
  };

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') ?? '{}') as {
        nickname?: string;
        first_name?: string;
        username?: string;
      };
    } catch {
      return {};
    }
  })();
  const displayName = user.nickname || user.first_name || user.username || 'Employee';

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-brand">
          <div className="chat-brand-mark">V</div>
          <div>
            <Text strong>Vibe AI</Text>
            <Text type="secondary" className="chat-sidebar-caption">
              Company assistant
            </Text>
          </div>
        </div>
        <Button
          icon={<span aria-hidden="true">+</span>}
          onClick={createNewConversation}
          loading={createResult.loading}
          block
        >
          New chat
        </Button>
        <Text className="chat-section-label">RECENT</Text>
        {conversationsResult.error ? (
          <Alert
            type="error"
            showIcon
            message="Could not load conversations"
            description={conversationsResult.error.message}
          />
        ) : conversationsResult.loading && !conversations.length ? (
          <div className="chat-sidebar-loading">
            <Spin size="small" />
          </div>
        ) : conversations.length ? (
          <List
            className="conversation-list"
            dataSource={conversations}
            renderItem={(conversation) => (
              <List.Item key={conversation.id}>
                <Button
                  type={
                    selectedConversationId === conversation.id
                      ? 'primary'
                      : 'text'
                  }
                  className="conversation-button"
                  onClick={() => {
                    setSelectedConversationId(conversation.id);
                    setSending(false);
                    setActionError(undefined);
                  }}
                >
                  {conversation.title}
                </Button>
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary" className="chat-sidebar-empty">
            Your chats will appear here.
          </Text>
        )}
        <div className="chat-sidebar-footer">
          {isAdmin && (
            <Button type="text" block onClick={onSettings}>
              Settings
            </Button>
          )}
          <Text ellipsis className="chat-user-name">
            {displayName}
          </Text>
          <Button type="text" block onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-topbar">
          <div>
            <Text className="eyebrow">VIBE AI</Text>
            <Text className="chat-topbar-title">
              {activeConversation?.title ?? 'Company assistant'}
            </Text>
          </div>
          <Tag color={subscriptionResult.error ? 'red' : 'blue'}>
            {subscriptionResult.error ? 'Disconnected' : 'Realtime'}
          </Tag>
        </header>

        {actionError && (
          <Alert
            type="error"
            showIcon
            message={actionError}
            className="chat-alert"
            closable
            onClose={() => setActionError(undefined)}
          />
        )}

        <div className="chat-scroll-area">
          {!selectedConversationId ? (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">✦</div>
              <Title level={2}>What can I help you with?</Title>
              <Paragraph>
                Ask about company systems, processes, or anything you need help
                finding.
              </Paragraph>
              {conversationsResult.error && (
                <Button
                  type="primary"
                  onClick={() => void createNewConversation()}
                >
                  Start a new chat
                </Button>
              )}
              {!conversationsResult.loading &&
                !conversationsResult.error &&
                conversations.length === 0 && (
                  <Button
                    type="primary"
                    onClick={() => void createNewConversation()}
                  >
                    Start a new chat
                  </Button>
                )}
            </div>
          ) : messagesResult.loading && !messages.length ? (
            <div className="chat-loading">
              <Spin />
            </div>
          ) : messagesResult.error ? (
            <Alert
              type="error"
              showIcon
              message="Could not load this conversation"
              description={messagesResult.error.message}
            />
          ) : messages.length ? (
            <div className="message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`chat-message chat-message-${message.role}`}
                >
                  <Text className="message-role">
                    {message.role === 'user' ? 'You' : 'Vibe AI'}
                  </Text>
                  {message.content ? (
                    <Paragraph className="message-content">
                      {message.content}
                    </Paragraph>
                  ) : (
                    <Spin size="small" />
                  )}
                  {message.status === 'failed' && (
                    <Text type="danger" className="message-status">
                      Response interrupted. You can try again.
                    </Text>
                  )}
                </article>
              ))}
              <div ref={messageEndRef} />
            </div>
          ) : (
            <div className="chat-welcome chat-welcome-compact">
              <div className="chat-welcome-icon">✦</div>
              <Title level={3}>What can I help you with?</Title>
              <Paragraph>Ask your question below to get started.</Paragraph>
            </div>
          )}
        </div>

        <div className="chat-composer-wrap">
          <div className="chat-composer">
            <Input.TextArea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder={
                selectedConversationId
                  ? 'Ask Vibe AI anything...'
                  : 'Start a new chat to ask a question'
              }
              autoSize={{ minRows: 1, maxRows: 5 }}
              maxLength={8000}
              disabled={!selectedConversationId || assistantIsStreaming}
              aria-label="Message Vibe AI"
            />
            <Button
              type="primary"
              shape="circle"
              icon={<span aria-hidden="true">↑</span>}
              onClick={() => void submitMessage()}
              disabled={
                !draft.trim() || !selectedConversationId || assistantIsStreaming
              }
              loading={sendResult.loading}
              aria-label="Send message"
            />
          </div>
          <Text type="secondary" className="chat-disclaimer">
            AI responses can be inaccurate. Verify important information.
          </Text>
        </div>
      </section>
    </main>
  );
}
