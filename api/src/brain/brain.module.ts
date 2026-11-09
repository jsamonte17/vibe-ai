import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { BrainActionsService } from './brain-actions.service';
import { DatabaseSearchModule } from './database-search/database-search.module';
import { BrainService } from './brain.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuthModule, KnowledgeModule, DatabaseSearchModule, SettingsModule],
  providers: [BrainActionsService, BrainService],
  exports: [BrainService],
})
export class BrainModule {}
