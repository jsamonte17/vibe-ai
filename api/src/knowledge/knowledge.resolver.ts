import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../settings/admin.guard';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeEntryInput,
  KnowledgeEntryResult,
  KnowledgeTagResult,
} from './knowledge.types';

@Resolver()
export class KnowledgeResolver {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Query('knowledgeEntries')
  @UseGuards(AuthGuard, AdminGuard)
  knowledgeEntries(): Promise<KnowledgeEntryResult[]> {
    return this.knowledgeService.findAll();
  }

  @Query('knowledgeTags')
  @UseGuards(AuthGuard, AdminGuard)
  knowledgeTags(): Promise<KnowledgeTagResult[]> {
    return this.knowledgeService.findAllTags();
  }

  @Mutation('createKnowledgeEntry')
  @UseGuards(AuthGuard, AdminGuard)
  createKnowledgeEntry(
    @Args('input') input: CreateKnowledgeEntryInput,
  ): Promise<KnowledgeEntryResult> {
    return this.knowledgeService.create(input);
  }
}
