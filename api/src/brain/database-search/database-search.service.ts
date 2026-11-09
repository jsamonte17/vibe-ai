import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectConnection, InjectModel } from "@nestjs/sequelize"
import { QueryTypes, Sequelize } from "sequelize"
import { BrainDatabaseReference } from "./brain-database-reference.model"

const MAX_SEARCH_TERMS = 8
const MAX_TAGS = 5
const MAX_TABLES = 3
const MAX_RESULT_ROWS = 20
const QUERY_TIMEOUT_MS = 3000
const DEFAULT_OLLAMA_REQUEST_TIMEOUT_MS = 300000
const SEARCHABLE_TABLES = ["KnowledgeEntries"] as const
const KNOWLEDGE_QUERY_TABLES = [
  "KnowledgeEntries",
  "KnowledgeEntryTags",
  "KnowledgeTags"
]
const REQUIRED_COLUMNS: Record<string, string[]> = {
  KnowledgeEntries: ["id", "title", "content", "createdAt", "updatedAt"],
  KnowledgeEntryTags: ["knowledgeEntryId", "knowledgeTagId"],
  KnowledgeTags: ["id", "name", "normalizedName"]
}

interface DatabaseSearchPlan {
  tables: string[]
  searchTerms: string[]
  tags: string[]
}

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

@Injectable()
export class DatabaseSearchService {
  private readonly logger = new Logger(DatabaseSearchService.name)

  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
    @InjectModel(BrainDatabaseReference)
    private readonly referenceModel: typeof BrainDatabaseReference,
    private readonly configService: ConfigService
  ) {}

  async search(
    question: string,
    conversationId?: string
  ): Promise<{
    references: string[]
    rows: Record<string, unknown>[]
  }> {
    const references = await this.referenceModel.findAll({
      where: { enabled: true },
      order: [["tableName", "ASC"]]
    })
    if (!references.length) {
      throw new ServiceUnavailableException(
        "The Brain database reference catalog is empty."
      )
    }
    const enabledTables = new Set(references.map(({ tableName }) => tableName))
    const missingTables = KNOWLEDGE_QUERY_TABLES.filter(
      (tableName) => !enabledTables.has(tableName)
    )
    if (missingTables.length) {
      throw new ServiceUnavailableException(
        `The approved knowledge search is missing database references for: ${missingTables.join(", ")}.`
      )
    }
    const invalidReferences = references
      .filter(({ tableName }) => KNOWLEDGE_QUERY_TABLES.includes(tableName))
      .filter(({ tableName, columns }) =>
        REQUIRED_COLUMNS[tableName].some((column) => !columns.includes(column))
      )
      .map(({ tableName }) => tableName)
    if (invalidReferences.length) {
      throw new ServiceUnavailableException(
        `The approved knowledge search has incomplete column references for: ${invalidReferences.join(", ")}.`
      )
    }
    const searchableTables = SEARCHABLE_TABLES.filter((tableName) =>
      enabledTables.has(tableName)
    )

    const plan = await this.generateSearchPlan(
      question,
      references,
      searchableTables
    )
    const { sql, bind } = this.buildKnowledgeQuery(plan)
    const logPrefix = conversationId
      ? `Conversation ${conversationId}: `
      : ""

    try {
      this.logger.log(
        `${logPrefix}selected table(s): ${plan.tables.join(", ")}; executing read-only knowledge query`
      )
      const rows = await this.sequelize.transaction(async (transaction) => {
        await this.sequelize.query("SET TRANSACTION READ ONLY", {
          transaction
        })
        await this.sequelize.query(
          `SET LOCAL statement_timeout = '${QUERY_TIMEOUT_MS}ms'`,
          { transaction }
        )
        return this.sequelize.query<Record<string, unknown>>(sql, {
          bind,
          transaction,
          type: QueryTypes.SELECT
        })
      })
      this.logger.log(
        `${logPrefix}read-only knowledge query returned ${rows.length} row(s)`
      )

      return {
        references: KNOWLEDGE_QUERY_TABLES,
        rows
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown PostgreSQL error"
      this.logger.warn(
        `${logPrefix}read-only knowledge query failed: ${detail}`
      )
      throw new ServiceUnavailableException(
        "The approved knowledge search could not be completed."
      )
    }
  }

  private async generateSearchPlan(
    question: string,
    references: BrainDatabaseReference[],
    searchableTables: readonly string[]
  ): Promise<DatabaseSearchPlan> {
    const model =
      this.configService.get<string>("OLLAMA_DATABASE_MODEL")?.trim() ||
      this.configService.get<string>("OLLAMA_BRAIN_MODEL")?.trim() ||
      "qwen2.5:3b"
    const baseUrl = (
      this.configService.get<string>("OLLAMA_BASE_URL") ||
      "http://localhost:11434"
    ).replace(/\/+$/, "")
    const configuredTimeout = this.configService.get<string>(
      "OLLAMA_REQUEST_TIMEOUT_MS"
    )
    const timeoutMs = configuredTimeout
      ? Number(configuredTimeout)
      : DEFAULT_OLLAMA_REQUEST_TIMEOUT_MS
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new ServiceUnavailableException(
        "OLLAMA_REQUEST_TIMEOUT_MS must be a positive integer."
      )
    }
    const signal = AbortSignal.timeout(timeoutMs)
    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          options: { temperature: 0 },
          messages: [
            {
              role: "system",
              content: [
                "First select the approved data table or tables that can contain information relevant to the question, then create a search plan for those tables. Do not generate SQL.",
                'Return JSON only in this shape: {"tables":["..."],"searchTerms":["..."],"tags":["..."]}.',
                `The following enabled references came from BrainDatabaseReferences. Select only relevant answer-source tables from this queryable list: ${JSON.stringify(searchableTables)}.`,
                "KnowledgeTags and KnowledgeEntryTags are supporting tables for labels and relationships; do not select them as standalone answer sources.",
                "Use 1 to 8 concise searchTerms based on the employee question. Use only relevant exact existing tag names in tags; use an empty array if no tag is relevant.",
                "Search terms match words in entry titles or contents. Tags match KnowledgeTags.name.",
                `Available tables and columns: ${JSON.stringify(
                  references.map((reference) => ({
                    table: reference.tableName,
                    description: reference.description,
                    columns: reference.columns,
                    relationships: reference.relationships
                  }))
                )}`
              ].join("\n")
            },
            {
              role: "user",
              content: question.slice(0, 2000)
            }
          ]
        }),
        signal
      })
    } catch (error) {
      if (signal.aborted) {
        throw new ServiceUnavailableException(
          `The database-search planning request timed out after ${timeoutMs} ms.`
        )
      }
      throw error
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        "The database-search model could not create a search plan."
      )
    }

    let result: OllamaChatResponse
    try {
      result = (await response.json()) as OllamaChatResponse
    } catch (error) {
      if (signal.aborted) {
        throw new ServiceUnavailableException(
          `The database-search planning request timed out after ${timeoutMs} ms.`
        )
      }
      throw error
    }
    if (result.error || typeof result.message?.content !== "string") {
      throw new ServiceUnavailableException(
        "The database-search model returned an invalid response."
      )
    }

    let plan: unknown
    try {
      plan = JSON.parse(result.message.content)
    } catch {
      throw new ServiceUnavailableException(
        "The database-search model returned malformed JSON."
      )
    }

    if (
      typeof plan !== "object" ||
      plan === null ||
      !("tables" in plan) ||
      !Array.isArray(plan.tables) ||
      !("searchTerms" in plan) ||
      !Array.isArray(plan.searchTerms) ||
      !("tags" in plan) ||
      !Array.isArray(plan.tags)
    ) {
      throw new ServiceUnavailableException(
        "The database-search model returned an invalid search plan."
      )
    }

    const tables = this.validateStrings(plan.tables, MAX_TABLES, "table")
    const availableTableNames = new Set(
      references.map(({ tableName }) => tableName)
    )
    if (
      !tables.length ||
      tables.some(
        (tableName) =>
          !searchableTables.includes(tableName) ||
          !availableTableNames.has(tableName)
      )
    ) {
      throw new ServiceUnavailableException(
        "The database-search model selected an unavailable or unsupported table."
      )
    }

    const searchTerms = this.validateStrings(
      plan.searchTerms,
      MAX_SEARCH_TERMS,
      "search term"
    )
    const tags = this.validateStrings(plan.tags, MAX_TAGS, "tag")
    if (!searchTerms.length && !tags.length) {
      throw new ServiceUnavailableException(
        "The database-search model returned an empty search plan."
      )
    }
    return { tables, searchTerms, tags }
  }

  private validateStrings(
    values: unknown[],
    maxItems: number,
    label: string
  ): string[] {
    if (
      values.length > maxItems ||
      values.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value.trim().length > 100
      )
    ) {
      throw new ServiceUnavailableException(
        `The database-search model returned an invalid ${label} list.`
      )
    }
    return [...new Set(values.map((value) => (value as string).trim()))]
  }

  private buildKnowledgeQuery(plan: DatabaseSearchPlan): {
    sql: string
    bind: string[]
  } {
    if (
      plan.tables.length !== 1 ||
      plan.tables[0] !== "KnowledgeEntries"
    ) {
      throw new ServiceUnavailableException(
        "The selected table does not have an approved query builder."
      )
    }

    const bind: string[] = []
    const predicates: string[] = []

    if (plan.searchTerms.length) {
      const termPredicates = plan.searchTerms.map((term) => {
        bind.push(`%${term}%`)
        const parameter = `$${bind.length}`
        return `("entry"."title" ILIKE ${parameter} OR "entry"."content" ILIKE ${parameter})`
      })
      predicates.push(`(${termPredicates.join(" OR ")})`)
    }

    if (plan.tags.length) {
      const tagParameters = plan.tags.map((tag) => {
        bind.push(tag.toLocaleLowerCase())
        return `$${bind.length}`
      })
      predicates.push(`"tag"."normalizedName" IN (${tagParameters.join(", ")})`)
    }

    return {
      sql: [
        'SELECT "entry"."id", "entry"."title", "entry"."content",',
        'array_agg(DISTINCT "tag"."name") FILTER (WHERE "tag"."id" IS NOT NULL) AS "tags",',
        '"entry"."createdAt", "entry"."updatedAt"',
        'FROM "KnowledgeEntries" AS "entry"',
        'LEFT JOIN "KnowledgeEntryTags" AS "entryTag" ON "entryTag"."knowledgeEntryId" = "entry"."id"',
        'LEFT JOIN "KnowledgeTags" AS "tag" ON "tag"."id" = "entryTag"."knowledgeTagId"',
        `WHERE ${predicates.join(" AND ")}`,
        'GROUP BY "entry"."id"',
        'ORDER BY "entry"."updatedAt" DESC, "entry"."id" DESC',
        `LIMIT ${MAX_RESULT_ROWS}`
      ].join(" "),
      bind
    }
  }
}
