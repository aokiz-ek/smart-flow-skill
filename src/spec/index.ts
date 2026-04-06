/**
 * OpenSpec 集成工具
 * 读取、写入、查找 openspec/ 目录规范文件，生成 spec-driven 提示词
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpecFile {
  capability: string;
  filePath: string;
  content: string;
}

export interface ChangeProposal {
  id: string;
  dir: string;
  proposalContent?: string;
  designContent?: string;
  tasksContent?: string;
  specDeltas: Array<{ capability: string; content: string }>;
}

// ─── Detection ──────────────────────────────────────────────────────────────

/** 检测项目是否包含 openspec 目录 */
export function hasOpenSpec(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, 'openspec'));
}

// ─── Spec File Operations ────────────────────────────────────────────────────

/** 列出所有 openspec/specs/[capability]/spec.md */
export function listSpecs(cwd: string): SpecFile[] {
  const specsDir = path.join(cwd, 'openspec', 'specs');
  if (!fs.existsSync(specsDir)) return [];
  const results: SpecFile[] = [];
  try {
    const entries = fs.readdirSync(specsDir, { withFileTypes: true });
    for (const entry of entries.filter((e) => e.isDirectory())) {
      const specFile = path.join(specsDir, entry.name, 'spec.md');
      if (fs.existsSync(specFile)) {
        results.push({
          capability: entry.name,
          filePath: specFile,
          content: fs.readFileSync(specFile, 'utf-8'),
        });
      }
    }
  } catch { /* ignore */ }
  return results;
}

/** 列出所有 openspec/changes/[id]/ change proposals */
export function listChanges(cwd: string): ChangeProposal[] {
  const changesDir = path.join(cwd, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) return [];
  const results: ChangeProposal[] = [];
  try {
    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    for (const entry of entries.filter((e) => e.isDirectory())) {
      const changeDir = path.join(changesDir, entry.name);
      const proposalFile = path.join(changeDir, 'proposal.md');
      if (!fs.existsSync(proposalFile)) continue;

      const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : undefined);
      const specsDir2 = path.join(changeDir, 'specs');
      const specDeltas: ChangeProposal['specDeltas'] = [];
      if (fs.existsSync(specsDir2)) {
        for (const f of fs.readdirSync(specsDir2).filter((f) => f.endsWith('.md'))) {
          specDeltas.push({
            capability: path.basename(f, '.md'),
            content: fs.readFileSync(path.join(specsDir2, f), 'utf-8'),
          });
        }
      }
      results.push({
        id: entry.name,
        dir: changeDir,
        proposalContent: read(proposalFile),
        designContent: read(path.join(changeDir, 'design.md')),
        tasksContent: read(path.join(changeDir, 'tasks.md')),
        specDeltas,
      });
    }
  } catch { /* ignore */ }
  return results;
}

/** 根据文件路径列表，模糊匹配相关的 spec */
export function findRelatedSpecs(files: string[], cwd: string): SpecFile[] {
  const specs = listSpecs(cwd);
  if (!specs.length || !files.length) return [];
  return specs.filter((spec) =>
    files.some((f) => {
      const base = path.basename(f, path.extname(f)).toLowerCase();
      const cap = spec.capability.toLowerCase();
      return base.includes(cap) || cap.includes(base) || f.toLowerCase().includes(cap.replace(/-/g, '/'));
    })
  );
}

/** 加载最新的 change proposal（按目录名排序取最后一个） */
export function loadLatestChange(cwd: string): ChangeProposal | null {
  const changes = listChanges(cwd);
  if (!changes.length) return null;
  return changes.sort((a, b) => b.id.localeCompare(a.id))[0];
}

// ─── Write Operations ────────────────────────────────────────────────────────

/** 生成唯一 change ID（yyyymmdd-xxxx 格式） */
export function generateChangeId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}-${rand}`;
}

/** 写入 change proposal 文件包到 openspec/changes/[changeId]/ */
export function writeChangeFiles(
  changeId: string,
  files: {
    proposal: string;
    design: string;
    tasks: string;
    specDeltas?: Array<{ capability: string; content: string }>;
  },
  cwd: string
): string {
  const changeDir = path.join(cwd, 'openspec', 'changes', changeId);
  fs.mkdirSync(changeDir, { recursive: true });
  fs.writeFileSync(path.join(changeDir, 'proposal.md'), files.proposal, 'utf-8');
  fs.writeFileSync(path.join(changeDir, 'design.md'), files.design, 'utf-8');
  fs.writeFileSync(path.join(changeDir, 'tasks.md'), files.tasks, 'utf-8');
  if (files.specDeltas?.length) {
    const specsDir = path.join(changeDir, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });
    for (const delta of files.specDeltas) {
      fs.writeFileSync(path.join(specsDir, `${delta.capability}.md`), delta.content, 'utf-8');
    }
  }
  return changeDir;
}

/** 初始化 spec.md 文件（openspec/specs/[capability]/spec.md） */
export function writeSpecFile(capability: string, content: string, cwd: string): string {
  const specDir = path.join(cwd, 'openspec', 'specs', capability);
  fs.mkdirSync(specDir, { recursive: true });
  const filePath = path.join(specDir, 'spec.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 截断 spec 内容，避免注入过多 token */
export function truncateSpec(content: string, maxLen = 1200): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '\n\n... （已截断，完整内容见原文件）';
}

// ─── Templates ───────────────────────────────────────────────────────────────

/** spec.md 初始模板 */
export function specTemplate(capability: string): string {
  return `# ${capability}

## Purpose

[描述此功能模块的业务用途和价值]

## Requirements

### REQ-001: [需求名称]

[需求描述]

## Scenarios

### Scenario: [场景名称]

GIVEN [前置条件]
WHEN [用户操作或系统事件]
THEN [预期结果（可量化）]
`;
}

/** spec delta 模板 */
export function specDeltaTemplate(capability: string, description: string): string {
  return `# Spec Delta: ${capability}

> 变更描述：${description}

## 新增需求

[新增的需求条目]

## 修改需求

**变更前：**
[原需求内容]

**变更后：**
[新需求内容]

## 新增场景

GIVEN [前置条件]
WHEN [用户操作]
THEN [预期结果]
`;
}

/** proposal.md 模板（给 AI 填充） */
export function proposalTemplate(changeId: string, description: string): string {
  return `# Change Proposal: ${description}

> Change ID: ${changeId}

## 变更描述

[1-3 句话说明这个变更要做什么]

## 动机与背景

[为什么需要这个变更，解决什么问题]

## 影响范围

- 涉及的 Capability：[列表]
- 影响的用户角色：[列表]
- 影响的现有功能：[列表]

## 非功能性考量

- 性能影响：[说明或无]
- 安全考量：[说明或无]
- 向后兼容性：[说明]
`;
}

/** design.md 模板 */
export function designTemplate(description: string): string {
  return `# Technical Design: ${description}

## 架构决策

[关键架构选择及原因]

## 接口变更

[新增/修改的 API、组件接口]

## 数据模型变更

[数据结构变更说明]

## 实现方案

[核心实现思路]

## 风险与缓解措施

[技术风险点及对策]
`;
}

/** tasks.md 模板 */
export function tasksTemplate(description: string): string {
  return `# Implementation Tasks: ${description}

## Phase 1: 基础准备

- [ ] Task 1.1: [任务描述] | 估算：S
- [ ] Task 1.2: [任务描述] | 估算：M

## Phase 2: 核心实现

- [ ] Task 2.1: [任务描述] | 估算：M
- [ ] Task 2.2: [任务描述] | 估算：L

## Phase 3: 测试与验收

- [ ] Task 3.1: 编写单元测试，覆盖所有 AC
- [ ] Task 3.2: Spec Review — 验证代码实现与 spec delta 对齐

## 总估算

S: 0 | M: 0 | L: 0
`;
}
