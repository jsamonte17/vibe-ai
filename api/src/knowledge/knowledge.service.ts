import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { KnowledgeEntry } from './knowledge-entry.model';
import { KnowledgeTag } from './knowledge-tag.model';
import {
  CreateKnowledgeEntryInput,
  KnowledgeEntryResult,
  KnowledgeTagResult,
} from './knowledge.types';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
    @InjectModel(KnowledgeEntry)
    private readonly knowledgeEntryModel: typeof KnowledgeEntry,
    @InjectModel(KnowledgeTag)
    private readonly knowledgeTagModel: typeof KnowledgeTag,
  ) {}

  async findAll(): Promise<KnowledgeEntryResult[]> {
    const entries = await this.knowledgeEntryModel.findAll({
      include: [{ model: KnowledgeTag, through: { attributes: [] } }],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      tags: this.toTagResults(entry.tags),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }));
  }

  async search(query: string): Promise<KnowledgeEntryResult[]> {
    const terms = [
      ...new Set(
        query
          .trim()
          .split(/\s+/)
          .map((term) => term.trim())
          .filter(Boolean),
      ),
    ].slice(0, 8);

    if (!terms.length) {
      return [];
    }

    const entries = await this.knowledgeEntryModel.findAll({
      where: {
        [Op.or]: terms.flatMap((term) => [
          { title: { [Op.iLike]: `%${term}%` } },
          { content: { [Op.iLike]: `%${term}%` } },
        ]),
      },
      include: [{ model: KnowledgeTag, through: { attributes: [] } }],
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit: 5,
    });

    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      tags: this.toTagResults(entry.tags),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }));
  }

  async create(
    input: CreateKnowledgeEntryInput,
  ): Promise<KnowledgeEntryResult> {
    const title = input.title.trim();
    const content = input.content.trim();
    const tagNames = this.normalizeTagNames(input.tags);

    if (!title || !content) {
      throw new BadRequestException('Title and content are required.');
    }

    const entry = await this.sequelize.transaction(
      async (transaction) => {
        const createdEntry = await this.knowledgeEntryModel.create(
          { title, content },
          { transaction },
        );
        const tags: KnowledgeTag[] = [];

        for (const tagName of tagNames) {
          const normalizedName = tagName.toLocaleLowerCase();
          const [tag] = await this.knowledgeTagModel.findOrCreate({
            where: { normalizedName },
            defaults: { name: tagName, normalizedName },
            transaction,
          });
          tags.push(tag);
        }

        await createdEntry.$set('tags', tags, { transaction });
        return createdEntry.reload({
          include: [{ model: KnowledgeTag, through: { attributes: [] } }],
          transaction,
        });
      },
    );

    return {
      id: entry.id,
      title: entry.title,
      content: entry.content,
      tags: this.toTagResults(entry.tags),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async findAllTags(): Promise<KnowledgeTagResult[]> {
    const tags = await this.knowledgeTagModel.findAll({
      order: [['name', 'ASC']],
    });

    return this.toTagResults(tags);
  }

  private normalizeTagNames(tags: string[] | undefined): string[] {
    if (!tags) {
      return [];
    }

    if (tags.length > 20) {
      throw new BadRequestException('A knowledge entry can have at most 20 tags.');
    }

    const uniqueTags = new Map<string, string>();
    for (const value of tags) {
      const name = value.trim();
      if (!name) {
        continue;
      }

      if (name.length > 64) {
        throw new BadRequestException('Tags must be 64 characters or fewer.');
      }

      const normalizedName = name.toLocaleLowerCase();
      if (!uniqueTags.has(normalizedName)) {
        uniqueTags.set(normalizedName, name);
      }
    }

    return [...uniqueTags.values()];
  }

  private toTagResults(tags: KnowledgeTag[] = []): KnowledgeTagResult[] {
    return tags.map(({ id, name }) => ({ id, name }));
  }
}
