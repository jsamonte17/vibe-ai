import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BrainDatabaseReference } from './brain-database-reference.model';
import { DatabaseSearchService } from './database-search.service';

@Module({
  imports: [SequelizeModule.forFeature([BrainDatabaseReference])],
  providers: [DatabaseSearchService],
  exports: [DatabaseSearchService],
})
export class DatabaseSearchModule {}
