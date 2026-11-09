import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo"
import { GraphQLModule } from "@nestjs/graphql"
import { ConfigModule } from "@nestjs/config"
import { Module } from "@nestjs/common"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { join } from "node:path"
import { AppResolver } from "./app.resolver"
import { SequelizeModule } from "@nestjs/sequelize"
import { KnowledgeEntry } from "./knowledge/knowledge-entry.model"
import { KnowledgeEntryTag } from "./knowledge/knowledge-entry-tag.model"
import { KnowledgeModule } from "./knowledge/knowledge.module"
import { KnowledgeTag } from "./knowledge/knowledge-tag.model"
import { AuthModule } from "./auth/auth.module"
import { ChatModule } from "./chat/chat.module"
import { ChatConversation } from "./chat/chat-conversation.model"
import { ChatMessage } from "./chat/chat-message.model"
import { BrainDatabaseReference } from "./brain/database-search/brain-database-reference.model"
import { SettingsModule } from "./settings/settings.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env"
    }),
    SequelizeModule.forRoot({
      dialect: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || "vibe_ai",
      password: process.env.DB_PASSWORD || "vibe_ai_local",
      database: process.env.DB_NAME || "vibe_ai",
      models: [
        KnowledgeEntry,
        KnowledgeTag,
        KnowledgeEntryTag,
        ChatConversation,
        ChatMessage,
        BrainDatabaseReference,
      ],
      autoLoadModels: true,
      synchronize: false,
      logging: process.env.DB_LOGGING === "true"
    }),
    AuthModule,
    ChatModule,
    KnowledgeModule,
    SettingsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      typePaths: [join(__dirname, "*.graphql")],
      subscriptions: {
        "graphql-ws": true,
      },
      context: (context: {
        req?: { headers?: Record<string, string>; user?: unknown };
        connectionParams?: Record<string, unknown>;
        extra?: { request?: { headers?: Record<string, string> } };
      }) => ({
        req: context.req ?? context.extra?.request,
        connectionParams: context.connectionParams,
        extra: context.extra,
      }),
    })
  ],
  providers: [AppResolver]
})
export class AppModule {}
