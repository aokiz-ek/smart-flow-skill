/**
 * Ethan Memory System — Core Module
 * 提供持久化记忆存储、全文检索、标签索引和知识图谱能力
 *
 * 存储结构：
 *   ~/.ethan-memory/          全局记忆库
 *   .ethan/memory/            项目级记忆库
 *   .ethan/memory/index.json  快速检索索引（自动维护）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { MemoryEntry, MemoryIndex, SearchResult, MemoryStats } from './types';

export * from './types';

// ─── 存储路径 ─────────────────────────────────────────────────────────────────
export const GLOBAL_MEMORY_DIR = path.join(os.homedir(), '.ethan-memory');

export function getMemoryDir(global: boolean, cwd?: string): string {
  return global ? GLOBAL_MEMORY_DIR : path.join(cwd ?? process.cwd(), '.ethan', 'memory');
}

// ─── 文件 I/O ─────────────────────────────────────────────────────────────────
export function loadAllEntries(dir: string): MemoryEntry[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as MemoryEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is MemoryEntry => e !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveEntry(entry: MemoryEntry, dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${entry.id}.json`),
    JSON.stringify(entry, null, 2),
    'utf-8',
  );
  // 保存后自动重建索引
  rebuildIndex(dir);
}

export function removeEntry(id: string, dir: string): boolean {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  rebuildIndex(dir);
  return true;
}

export function getEntry(id: string, dir: string): MemoryEntry | null {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as MemoryEntry;
  } catch {
    return null;
  }
}

// ─── 索引管理 ─────────────────────────────────────────────────────────────────
const INDEX_FILE = 'index.json';

export function loadIndex(dir: string): MemoryIndex | null {
  const file = path.join(dir, INDEX_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as MemoryIndex;
  } catch {
    return null;
  }
}

/** 从当前目录所有记忆条目重建索引（增量维护代价高，直接全量重建） */
export function rebuildIndex(dir: string): MemoryIndex {
  const entries = loadAllEntries(dir);
  const index: MemoryIndex = {
    version: 2,
    updatedAt: new Date().toISOString(),
    totalCount: entries.length,
    invertedIndex: {},
    tagIndex: {},
    typeIndex: { workflow: [], skill: [], manual: [], decision: [], knowledge: [] },
    projectIndex: {},
    skillIndex: {},
  };

  for (const entry of entries) {
    // 类型索引
    if (index.typeIndex[entry.type]) {
      index.typeIndex[entry.type].push(entry.id);
    }

    // 标签索引
    for (const tag of entry.tags) {
      (index.tagIndex[tag] ??= []).push(entry.id);
    }

    // 项目索引
    if (entry.project) {
      (index.projectIndex[entry.project] ??= []).push(entry.id);
    }

    // Skill 索引
    if (entry.skillId) {
      (index.skillIndex[entry.skillId] ??= []).push(entry.id);
    }

    // 倒排索引：对 title + summary + tags 分词
    const text = `${entry.title} ${entry.summary ?? ''} ${entry.tags.join(' ')}`;
    for (const token of tokenize(text)) {
      if (!index.invertedIndex[token]) {
        index.invertedIndex[token] = [entry.id];
      } else if (!index.invertedIndex[token].includes(entry.id)) {
        index.invertedIndex[token].push(entry.id);
      }
    }
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, INDEX_FILE), JSON.stringify(index, null, 2), 'utf-8');
  return index;
}

// ─── 检索 ─────────────────────────────────────────────────────────────────────
/**
 * 全文检索：对 title、content、summary、tags 加权匹配
 * 支持多词（所有词都命中得分最高）
 */
export function searchMemory(
  query: string,
  dir: string,
  opts: {
    type?: MemoryEntry['type'];
    tags?: string[];
    project?: string;
    limit?: number;
  } = {},
): SearchResult[] {
  const entries = loadAllEntries(dir);
  if (!entries.length) return [];

  const queryTokens = tokenize(query.toLowerCase());
  const results: SearchResult[] = [];

  for (const entry of entries) {
    // 类型过滤
    if (opts.type && entry.type !== opts.type) continue;
    // 标签过滤（AND 语义）
    if (opts.tags?.length && !opts.tags.every((t) => entry.tags.includes(t))) continue;
    // 项目过滤
    if (opts.project && entry.project !== opts.project) continue;

    const { score, matchedFields, snippet } = scoreEntry(entry, queryTokens, query);
    if (score > 0) {
      results.push({ entry, score, matchedFields, snippet });
    }
  }

  // 按分数降序，再按时间降序
  results.sort((a, b) => b.score - a.score || new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime());
  return results.slice(0, opts.limit ?? 20);
}

function scoreEntry(
  entry: MemoryEntry,
  queryTokens: string[],
  rawQuery: string,
): { score: number; matchedFields: string[]; snippet: string } {
  let score = 0;
  const matchedFields: string[] = [];

  const titleLower = entry.title.toLowerCase();
  const contentLower = entry.content.toLowerCase();
  const summaryLower = (entry.summary ?? '').toLowerCase();
  const tagsLower = entry.tags.map((t) => t.toLowerCase()).join(' ');
  const rawLower = rawQuery.toLowerCase();

  // 精确短语匹配（最高权重）
  if (titleLower.includes(rawLower)) { score += 100; matchedFields.push('title'); }
  if (summaryLower.includes(rawLower)) { score += 60; matchedFields.push('summary'); }
  if (contentLower.includes(rawLower)) { score += 30; matchedFields.push('content'); }
  if (tagsLower.includes(rawLower)) { score += 50; matchedFields.push('tags'); }

  // 分词匹配
  for (const token of queryTokens) {
    if (titleLower.includes(token)) score += 20;
    if (summaryLower.includes(token)) score += 10;
    if (contentLower.includes(token)) score += 5;
    if (tagsLower.includes(token)) score += 15;
  }

  // 重要度加权
  if (entry.rating) score += entry.rating * 5;

  // 生成摘要片段（显示匹配上下文）
  let snippet = entry.summary ?? entry.content.slice(0, 120);
  const idx = contentLower.indexOf(rawLower);
  if (idx > -1) {
    const start = Math.max(0, idx - 40);
    const end = Math.min(entry.content.length, idx + rawLower.length + 80);
    snippet = (start > 0 ? '...' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '...' : '');
  }

  return { score, matchedFields: [...new Set(matchedFields)], snippet };
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
/** 简单中英文分词（空格 + CJK 字符级别） */
function tokenize(text: string): string[] {
  const tokens = new Set<string>();
  // 英文分词（按空格和标点）
  for (const word of text.split(/[\s\-_.,!?，。！？\\/（）()\[\]]+/)) {
    if (word.length >= 2) tokens.add(word.toLowerCase());
  }
  // CJK 字符：每个字单独作为 token，也提取 2-gram
  const cjk = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g) ?? [];
  for (const seg of cjk) {
    for (let i = 0; i < seg.length; i++) {
      tokens.add(seg[i]);
      if (i + 1 < seg.length) tokens.add(seg.slice(i, i + 2));
    }
  }
  return [...tokens].filter((t) => t.length >= 1);
}

/** 生成短 ID（时间戳 + 随机） */
export function generateMemoryId(prefix?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${ts}-${rand}` : `${ts}-${rand}`;
}

// ─── 归档工作流产出 ───────────────────────────────────────────────────────────
export function archiveWorkflowOutput(opts: {
  skillId: string;
  pipelineId: string;
  summary: string;
  content: string;
  cwd: string;
  rating?: number;
}): MemoryEntry {
  const { skillId, pipelineId, summary, content, cwd, rating } = opts;
  const entry: MemoryEntry = {
    id: generateMemoryId(skillId),
    type: 'workflow',
    skillId,
    pipelineId,
    title: `[${pipelineId}] ${skillId} — ${summary.slice(0, 60)}`,
    content,
    summary: summary.slice(0, 200),
    tags: [skillId, pipelineId, path.basename(cwd)],
    project: path.basename(cwd),
    createdAt: new Date().toISOString(),
    source: 'workflow',
    ...(rating !== undefined ? { rating } : {}),
  };
  saveEntry(entry, getMemoryDir(false, cwd));
  return entry;
}

// ─── 统计 ─────────────────────────────────────────────────────────────────────
export function getMemoryStats(dir: string): MemoryStats {
  const entries = loadAllEntries(dir);
  const byType: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  let recentActivity = '';

  for (const e of entries) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    if (e.project) byProject[e.project] = (byProject[e.project] ?? 0) + 1;
    for (const t of e.tags) tagCount[t] = (tagCount[t] ?? 0) + 1;
    if (!recentActivity || e.createdAt > recentActivity) recentActivity = e.createdAt;
  }

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return { totalEntries: entries.length, byType, byProject, topTags, recentActivity };
}
