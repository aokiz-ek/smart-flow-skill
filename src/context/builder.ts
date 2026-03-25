/**
 * Project Context Snapshot Builder
 * 采集当前项目的技术栈、git 信息、目录树，用于注入到 Auto-Pilot / Workflow 提示词
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { detectProjectContext } from './detector';
import { isGitRepo, getCurrentBranch } from '../git/utils';

export interface ProjectSnapshot {
  projectName: string;
  techSummary: string;
  frameworks: string[];
  languages: string[];
  tools: string[];
  /** git log --oneline -20（非 git 仓库为空字符串） */
  recentCommits: string;
  /** 当前分支 */
  currentBranch: string;
  /** git status --short 前 20 行 */
  changedFiles: string[];
  /** 渲染后的文本目录树（depth=2） */
  directoryTree: string;
  /** ISO 时间戳 */
  generatedAt: string;
  cwd: string;
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '__pycache__', '.venv', 'vendor', '.turbo', 'out', '.cache',
]);
const CONTEXT_CACHE_FILE = path.join('.ethan', 'context.json');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Directory Tree ────────────────────────────────────────────────────────

function renderTree(dir: string, prefix: string, depth: number, isRoot: boolean): string[] {
  if (depth < 0) return [];
  const lines: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const sorted = entries
      .filter((e) => {
        if (IGNORE_DIRS.has(e.name)) return false;
        // root: keep dot-dirs (.ethan, .github); subdirs: skip hidden
        if (!isRoot && e.name.startsWith('.')) return false;
        return true;
      })
      .sort((a, b) => {
        // dirs first, then alphabetical
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        lines.push(`${prefix}📁 ${entry.name}/`);
        if (depth > 0) {
          lines.push(...renderTree(fullPath, prefix + '  ', depth - 1, false));
        }
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  } catch {
    // permission issues — silently skip
  }
  return lines;
}

function buildDirectoryTree(cwd: string): string {
  try {
    const lines = renderTree(cwd, '', 2, true);
    return lines.join('\n');
  } catch {
    return '';
  }
}

// ─── Git helpers ───────────────────────────────────────────────────────────

function gitCmd(args: string[], cwd: string): string {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (r.status === 0) return (r.stdout || '').trim();
  } catch {
    // ignore
  }
  return '';
}

function getRecentCommits(cwd: string): string {
  return gitCmd(['log', '--oneline', '-20'], cwd);
}

function getChangedFiles(cwd: string): string[] {
  const output = gitCmd(['status', '--short'], cwd);
  if (!output) return [];
  return output.split('\n').filter(Boolean).slice(0, 20);
}

// ─── Snapshot ──────────────────────────────────────────────────────────────

/** 采集当前项目快照（实时） */
export function buildProjectSnapshot(cwd: string = process.cwd()): ProjectSnapshot {
  const ctx = detectProjectContext(cwd);

  let projectName = ctx.projectName || path.basename(cwd);
  const gitRepo = isGitRepo(cwd);
  const recentCommits = gitRepo ? getRecentCommits(cwd) : '';
  const currentBranch = gitRepo ? getCurrentBranch(cwd) : '';
  const changedFiles = gitRepo ? getChangedFiles(cwd) : [];
  const directoryTree = buildDirectoryTree(cwd);

  const snapshot: ProjectSnapshot = {
    projectName,
    techSummary: ctx.summary,
    frameworks: ctx.frameworks,
    languages: ctx.languages,
    tools: ctx.tools,
    recentCommits,
    currentBranch,
    changedFiles,
    directoryTree,
    generatedAt: new Date().toISOString(),
    cwd,
  };

  return snapshot;
}

/** 将快照格式化为可注入提示词的 Markdown 段落 */
export function formatSnapshotForPrompt(snapshot: ProjectSnapshot, isEn = false): string {
  const lines: string[] = [];

  if (isEn) {
    lines.push('## Project Context (Auto-Collected)', '');
    lines.push(`**Project**: ${snapshot.projectName}`);
    if (snapshot.languages.length) lines.push(`**Languages**: ${snapshot.languages.join(', ')}`);
    if (snapshot.frameworks.length) lines.push(`**Frameworks**: ${snapshot.frameworks.join(', ')}`);
    if (snapshot.tools.length) lines.push(`**Tools**: ${snapshot.tools.join(', ')}`);
    if (snapshot.currentBranch) lines.push(`**Branch**: ${snapshot.currentBranch}`);
    if (snapshot.changedFiles.length) {
      lines.push('', `**Changed Files** (${snapshot.changedFiles.length}):`);
      snapshot.changedFiles.slice(0, 10).forEach((f) => lines.push(`  ${f}`));
    }
    if (snapshot.recentCommits) {
      lines.push('', '**Recent Commits**:');
      snapshot.recentCommits.split('\n').slice(0, 10).forEach((l) => lines.push(`  ${l}`));
    }
    if (snapshot.directoryTree) {
      lines.push('', '**Project Structure**:', '```', snapshot.directoryTree, '```');
    }
  } else {
    lines.push('## 项目上下文（自动采集）', '');
    lines.push(`**项目名称**：${snapshot.projectName}`);
    if (snapshot.languages.length) lines.push(`**编程语言**：${snapshot.languages.join('、')}`);
    if (snapshot.frameworks.length) lines.push(`**框架/库**：${snapshot.frameworks.join('、')}`);
    if (snapshot.tools.length) lines.push(`**工具链**：${snapshot.tools.join('、')}`);
    if (snapshot.currentBranch) lines.push(`**当前分支**：${snapshot.currentBranch}`);
    if (snapshot.changedFiles.length) {
      lines.push('', `**变更文件**（${snapshot.changedFiles.length} 个）：`);
      snapshot.changedFiles.slice(0, 10).forEach((f) => lines.push(`  ${f}`));
    }
    if (snapshot.recentCommits) {
      lines.push('', '**近期提交**：');
      snapshot.recentCommits.split('\n').slice(0, 10).forEach((l) => lines.push(`  ${l}`));
    }
    if (snapshot.directoryTree) {
      lines.push('', '**目录结构**：', '```', snapshot.directoryTree, '```');
    }
  }

  return lines.join('\n');
}

// ─── Cache ─────────────────────────────────────────────────────────────────

/** 读取缓存快照（TTL 30min，过期或不存在返回 null） */
export function loadCachedSnapshot(cwd: string = process.cwd()): ProjectSnapshot | null {
  const filePath = path.join(cwd, CONTEXT_CACHE_FILE);
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProjectSnapshot;
    const age = Date.now() - new Date(data.generatedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/** 保存快照到缓存 */
export function saveSnapshotCache(snapshot: ProjectSnapshot, cwd: string = process.cwd()): void {
  const dir = path.join(cwd, '.ethan');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(cwd, CONTEXT_CACHE_FILE),
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );
  } catch {
    // ignore write errors
  }
}
