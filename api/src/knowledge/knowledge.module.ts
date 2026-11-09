import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeEntry } from './knowledge-entry.model';
import { KnowledgeEntryTag } from './knowledge-entry-tag.model';
import { KnowledgeResolver } from './knowledge.resolver';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTag } from './knowledge-tag.model';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    AuthModule,
    SettingsModule,
    SequelizeModule.forFeature([
      KnowledgeEntry,
      KnowledgeTag,
      KnowledgeEntryTag,
    ]),
  ],
  providers: [KnowledgeResolver, KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
