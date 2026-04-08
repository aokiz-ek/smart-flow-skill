/**
 * 自定义 Agent 加载器
 * 从项目的 .ethan/agents/ 目录加载用户自定义 Agent（YAML 或 JSON 格式）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentDefinition } from '../agents/types';

const CUSTOM_AGENTS_DIR = '.ethan/agents';

/**
 * 从指定目录加载自定义 Agent 定义
 * 支持 .yaml、.yml、.json 格式
 */
export function loadCustomAgents(cwd: string = process.cwd()): AgentDefinition[] {
  const agentsDir = path.join(cwd, CUSTOM_AGENTS_DIR);
  if (!fs.existsSync(agentsDir)) return [];

  const files = fs.readdirSync(agentsDir).filter((f) => /\.(ya?ml|json)$/i.test(f));
  const agents: AgentDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(agentsDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      let data: unknown;

      if (/\.json$/i.test(file)) {
        data = JSON.parse(raw);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const yaml = require('js-yaml') as { load: (s: string) => unknown };
        data = yaml.load(raw);
      }

      const agent = validateCustomAgent(data, file);
      if (agent) agents.push(agent);
    } catch (err) {
      console.warn(`  ⚠️  Failed to load custom agent: ${file} — ${(err as Error).message}`);
    }
  }

  return agents;
}

function validateCustomAgent(data: unknown, filename: string): AgentDefinition | null {
  if (typeof data !== 'object' || data === null) {
    console.warn(`  ⚠️  ${filename}: root must be an object`);
    return null;
  }

  const d = data as Record<string, unknown>;
  const required = ['id', 'name', 'nameEn', 'emoji', 'role', 'skillIds'];

  for (const key of required) {
    if (!d[key]) {
      console.warn(`  ⚠️  ${filename}: missing required field "${key}"`);
      return null;
    }
  }

  if (!Array.isArray(d.skillIds) || (d.skillIds as unknown[]).length === 0) {
    console.warn(`  ⚠️  ${filename}: "skillIds" must be a non-empty array`);
    return null;
  }

  return {
    id: String(d.id),
    name: String(d.name),
    nameEn: String(d.nameEn),
    emoji: String(d.emoji),
    role: String(d.role),
    skillIds: (d.skillIds as unknown[]).map(String),
  };
}

/** 生成自定义 Agent 的 YAML 模板 */
export function generateAgentTemplate(): string {
  return `# Ethan 自定义 Agent 模板
# 将此文件放在 .ethan/agents/ 目录下即可自动加载

id: my-agent              # 唯一标识符（同 id 覆盖内置 Agent）
name: My Agent            # 显示名称
nameEn: my-agent          # 英文名称
emoji: 🤖                 # 角色 Emoji
role: 负责 XXX 相关任务      # 角色职责描述（一句话）
skillIds:                 # 此 Agent 可执行的 Skill ID 列表
  - implementation
  - unit-testing
  - code-review
`;
}
