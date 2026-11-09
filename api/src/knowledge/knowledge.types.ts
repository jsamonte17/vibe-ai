export interface CreateKnowledgeEntryInput {
  title: string;
  content: string;
  tags: string[];
}

export interface KnowledgeTagResult {
  id: number;
  name: string;
}

export interface KnowledgeEntryResult {
  id: number;
  title: string;
  content: string;
  tags: KnowledgeTagResult[];
  createdAt: string;
  updatedAt: string;
}
