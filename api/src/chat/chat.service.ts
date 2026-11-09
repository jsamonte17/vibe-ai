import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common"
import { InjectModel } from "@nestjs/sequelize"
import { PubSub } from "graphql-subscriptions"
import { Op } from "sequelize"
import { BrainService } from "../brain/brain.service"
import { ChatConversation } from "./chat-conversation.model"
import {
  ChatMessage,
  ChatMessageRole,
  ChatMessageStatus
} from "./chat-message.model"
import {
  ChatConversationResult,
  ChatMessageResult,
  ChatUpdate,
  ChatUpdatePayload,
  SendChatMessageInput
} from "./chat.types"

const CHAT_UPDATE_TOPIC = (employeeId: string) => `chat-update:${employeeId}`
const MAX_HISTORY_MESSAGES = 20

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    @InjectModel(ChatConversation)
    private readonly conversationModel: typeof ChatConversation,
    @InjectModel(ChatMessage)
    private readonly messageModel: typeof ChatMessage,
    private readonly pubSub: PubSub,
    private readonly brainService: BrainService
  ) {}

  async listConversations(
    employeeId: string
  ): Promise<ChatConversationResult[]> {
    const conversations = await this.conversationModel.findAll({
      where: { employeeId },
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"]
      ]
    })

    return conversations.map((conversation) =>
      this.toConversationResult(conversation)
    )
  }

  async listMessages(
    employeeId: string,
    conversationId: string
  ): Promise<ChatMessageResult[]> {
    const conversation = await this.getOwnedConversation(
      employeeId,
      conversationId
    )
    const messages = await this.messageModel.findAll({
      where: { conversationId: conversation.id },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"]
      ]
    })

    return messages.map((message) => this.toMessageResult(message))
  }

  async createConversation(
    employeeId: string
  ): Promise<ChatConversationResult> {
    if (!employeeId) {
      throw new BadRequestException("An employee identity is required.")
    }

    const conversation = await this.conversationModel.create({
      employeeId,
      title: "New chat"
    })
    return this.toConversationResult(conversation)
  }

  async sendMessage(
    employeeId: string,
    input: SendChatMessageInput,
    username: string
  ): Promise<ChatMessageResult> {
    const content = input.content.trim()
    if (!content) {
      throw new BadRequestException("Message content is required.")
    }
    if (content.length > 8000) {
      throw new BadRequestException(
        "Messages must be 8,000 characters or fewer."
      )
    }
    this.logger.log("Received chat message")
    const conversation = input.conversationId
      ? await this.getOwnedConversation(employeeId, input.conversationId)
      : await this.conversationModel.create({
          employeeId,
          title: Array.from(content).slice(0, 200).join("")
        })

    if (conversation.title === "New chat") {
      await conversation.update({
        title: Array.from(content).slice(0, 200).join("")
      })
    }

    const history = await this.messageModel.findAll({
      where: { conversationId: conversation.id },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ],
      limit: MAX_HISTORY_MESSAGES
    })
    const userMessage = await this.messageModel.create({
      conversationId: conversation.id,
      role: "user",
      content,
      status: "complete"
    })
    const assistantMessage = await this.messageModel.create({
      conversationId: conversation.id,
      role: "assistant",
      content: "",
      status: "streaming"
    })
    await conversation.update({ updatedAt: new Date() })
    Logger.log(`Publishing update for employee ${employeeId}`)
    await this.publishUpdate(employeeId, assistantMessage, "", "")

    void this.generateResponse(
      employeeId,
      username,
      conversation,
      assistantMessage,
      [...history.reverse(), userMessage]
    ).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown persistence error"
      this.logger.error(
        `Assistant response handling failed for conversation ${conversation.id}: ${message}`
      )
    })

    return this.toMessageResult(userMessage)
  }

  async subscribeToUpdates(
    employeeId: string
  ): Promise<AsyncIterable<ChatUpdatePayload>> {
    if (!employeeId) {
      throw new BadRequestException("An employee identity is required.")
    }
    const service = this
    return {
      async *[Symbol.asyncIterator]() {
        const iterator =
          service.pubSub.asyncIterableIterator<ChatUpdatePayload>(
            CHAT_UPDATE_TOPIC(employeeId)
          )
        let pendingEvent = iterator.next()
        try {
          const conversations = await service.conversationModel.findAll({
            where: { employeeId },
            attributes: ["id"]
          })
          const activeMessages = conversations.length
            ? await service.messageModel.findAll({
                where: {
                  conversationId: {
                    [Op.in]: conversations.map(
                      (conversation) => conversation.id
                    )
                  },
                  role: "assistant",
                  status: "streaming"
                }
              })
            : []
          for (const message of activeMessages) {
            yield {
              chatUpdate: {
                ...service.toMessageResult(message),
                delta: ""
              }
            }
          }

          while (true) {
            const event = await pendingEvent
            if (event.done) {
              return
            }
            yield event.value
            pendingEvent = iterator.next()
          }
        } finally {
          await iterator.return?.()
        }
      }
    }
  }

  private async getOwnedConversation(
    employeeId: string,
    conversationId: string
  ): Promise<ChatConversation> {
    const id = Number(conversationId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException("Invalid conversation ID.")
    }

    const conversation = await this.conversationModel.findOne({
      where: { id, employeeId }
    })
    if (!conversation) {
      throw new NotFoundException("Conversation not found.")
    }
    return conversation
  }

  private async generateResponse(
    employeeId: string,
    username: string,
    conversation: ChatConversation,
    assistantMessage: ChatMessage,
    history: ChatMessage[]
  ): Promise<void> {
    let responseText = ""
    try {
      const currentUserMessage = [...history]
        .reverse()
        .find((message) => message.role === "user")?.content
      if (!currentUserMessage) {
        throw new BadRequestException("The user message is missing.")
      }

      const brainHistory = history.map(({ role, content }) => ({
        role,
        content
      }))
      let chunkCount = 0
      for await (const delta of this.brainService.streamResponse(
        brainHistory,
        employeeId,
        currentUserMessage,
        username,
        String(conversation.id)
      )) {
        responseText += delta
        chunkCount += 1
        await this.publishUpdate(
          employeeId,
          assistantMessage,
          delta,
          responseText
        )
        if (chunkCount % 8 === 0) {
          await assistantMessage.update({ content: responseText })
        }
      }

      if (!responseText.trim()) {
        throw new ServiceUnavailableException(
          "The Brain returned an empty response."
        )
      }

      await assistantMessage.update({
        content: responseText,
        status: "complete"
      })
      await conversation.update({ updatedAt: new Date() })
      await this.publishUpdate(
        employeeId,
        assistantMessage,
        "",
        responseText,
        "complete"
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown model error"
      this.logger.error(
        `Assistant response failed for conversation ${conversation.id}: ${message}`
      )
      const fallback =
        "I could not generate a response just now. Please try again."
      await assistantMessage.update({
        content: responseText || fallback,
        status: "failed"
      })
      await this.publishUpdate(
        employeeId,
        assistantMessage,
        "",
        responseText || fallback,
        "failed"
      )
    }
  }

  private async publishUpdate(
    employeeId: string,
    message: ChatMessage,
    delta: string,
    content: string,
    status: ChatMessageStatus = "streaming"
  ): Promise<void> {
    await this.pubSub.publish(CHAT_UPDATE_TOPIC(employeeId), {
      chatUpdate: {
        ...this.toMessageResult(message),
        content,
        delta,
        status
      }
    })
  }

  private toMessageResult(message: ChatMessage): ChatMessageResult {
    return {
      id: String(message.id),
      conversationId: String(message.conversationId),
      role: message.role as ChatMessageRole,
      content: message.content,
      status: message.status as ChatMessageStatus,
      createdAt: message.createdAt.toISOString()
    }
  }

  private toConversationResult(
    conversation: ChatConversation
  ): ChatConversationResult {
    return {
      id: String(conversation.id),
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString()
    }
  }
}
