/**
 * Ethan Memory System — Types
 * 跨会话持久化记忆与快速检索的类型定义
 */

export interface MemoryEntry {
  id: string;
  type: 'workflow' | 'skill' | 'manual' | 'decision' | 'knowledge';
  skillId?: string;
  pipelineId?: string;
  title: string;
  content: string;
  summary?: string;        // 摘要（≤200字）
  tags: string[];
  project?: string;
  createdAt: string;
  updatedAt?: string;
  rating?: number;         // 1-5 星重要度
  source?: string;         // 来源（workflow/manual/import）
  relatedIds?: string[];   // 关联记忆 ID（知识图谱）
}

export interface MemoryIndex {
  version: 2;
  updatedAt: string;
  totalCount: number;
  // 倒排索引：关键词 → 记忆 ID 列表（按相关度排序）
  invertedIndex: Record<string, string[]>;
  // 标签索引：tag → 记忆 ID 列表
  tagIndex: Record<string, string[]>;
  // 类型索引
  typeIndex: Record<MemoryEntry['type'], string[]>;
  // 项目索引
  projectIndex: Record<string, string[]>;
  // Skill 索引
  skillIndex: Record<string, string[]>;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchedFields: string[];
  snippet: string;
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  byProject: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentActivity: string;  // ISO date
}
