import { Injectable, Logger } from "@nestjs/common"
import { AuthService } from "../auth/auth.service"
import { KnowledgeService } from "../knowledge/knowledge.service"
import { KnowledgeEntryResult } from "../knowledge/knowledge.types"
import { PlatformSettingsService } from "../settings/platform-settings.service"
import { DatabaseSearchService } from "./database-search/database-search.service"

export type PlannedChatAction =
  | { type: "database_search"; question: string }
  | { type: "smarthr_self_profile" }
  | { type: "knowledge_write" }

export interface ChatActionResult {
  action: PlannedChatAction["type"]
  status: "complete" | "skipped" | "failed"
  data?: unknown
  message?: string
}

@Injectable()
export class BrainActionsService {
  private readonly logger = new Logger(BrainActionsService.name)

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly authService: AuthService,
    private readonly databaseSearchService: DatabaseSearchService,
    private readonly platformSettingsService: PlatformSettingsService
  ) {}

  async execute(
    actions: PlannedChatAction[],
    employeeId: string,
    userMessage: string,
    conversationId: string,
    username: string
  ): Promise<ChatActionResult[]> {
    const results: ChatActionResult[] = []

    for (const action of actions) {
      try {
        this.logger.log(
          `Conversation ${conversationId}: executing ${action.type}`
        )
        switch (action.type) {
          case "database_search":
            results.push({
              action: action.type,
              status: "complete",
              data: await this.databaseSearchService.search(
                action.question,
                conversationId
              )
            })
            break
          case "smarthr_self_profile":
            results.push({
              action: action.type,
              status: "complete",
              data: {
                ...(await this.authService.getEmployeeProfile(employeeId)),
                username
              }
            })
            break
          case "knowledge_write":
            results.push(
              (await this.platformSettingsService.isAdministrator(username))
                ? await this.saveKnowledge(userMessage)
                : {
                    action: action.type,
                    status: "skipped",
                    message:
                      "Only administrators can add entries to the company knowledge base."
                  }
            )
            break
        }
        const result = results[results.length - 1]
        this.logger.log(
          `Conversation ${conversationId}: ${action.type} ${result.status}`
        )
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown action error"
        this.logger.warn(`Chat action ${action.type} failed: ${detail}`)
        results.push({
          action: action.type,
          status: "failed",
          message:
            action.type === "smarthr_self_profile"
              ? "The employee profile could not be retrieved from SmartHR."
              : action.type === "database_search"
                ? "The approved knowledge database could not be searched."
                : "The knowledge action could not be completed."
        })
      }
    }

    return results
  }

  private async saveKnowledge(userMessage: string): Promise<ChatActionResult> {
    const trimmedMessage = userMessage.trim()
    const hasSaveIntent =
      /\b(?:remember|save|add|record|store)\b.{0,80}\b(?:knowledge|company profile|resolved issue|solution)\b/i.test(
        trimmedMessage
      ) ||
      /\b(?:knowledge|company profile|resolved issue|solution)\b.{0,80}\b(?:remember|save|add|record|store)\b/i.test(
        trimmedMessage
      )
    const tags = this.knowledgeTagsFor(trimmedMessage)

    if (!hasSaveIntent || !tags.length) {
      return {
        action: "knowledge_write",
        status: "skipped",
        message:
          "Saving requires an explicit request and company-profile or resolved-issue content."
      }
    }

    const content = this.removeSaveInstruction(trimmedMessage)
    if (!content) {
      return {
        action: "knowledge_write",
        status: "skipped",
        message: "No knowledge content was provided to save."
      }
    }

    const entry: KnowledgeEntryResult = await this.knowledgeService.create({
      title: this.titleFromContent(content),
      content,
      tags
    })

    return {
      action: "knowledge_write",
      status: "complete",
      data: { id: entry.id, title: entry.title, tags: entry.tags },
      message:
        "The submitted information was saved to the company knowledge base."
    }
  }

  private knowledgeTagsFor(content: string): string[] {
    const tags: string[] = []
    if (
      /\b(company profile|company information|about the company)\b/i.test(
        content
      )
    ) {
      tags.push("Company Profile")
    }
    if (/\b(resolved|fixed|solution|solved|workaround)\b/i.test(content)) {
      tags.push("Resolved Issue")
    }
    return tags
  }

  private removeSaveInstruction(content: string): string {
    return content
      .replace(
        /^\s*(?:please\s+)?(?:remember|save|add|record|store)\s+(?:this|that)\s*(?:to\s+(?:the\s+)?(?:company\s+)?knowledge(?:\s+base)?)?\s*[:,—-]?\s*/i,
        ""
      )
      .trim()
  }

  private titleFromContent(content: string): string {
    const firstSentence = content.split(/\r?\n|(?<=[.!?])\s/)[0].trim()
    return Array.from(firstSentence || content)
      .slice(0, 255)
      .join("")
  }
}
