/**
 * agents/index.ts
 * 导出活跃 Agent 列表（内置 + 自定义）
 */

export { BUILT_IN_AGENTS, buildSkillRouting, getAgentsForPipeline } from './presets';
export { buildMultiAgentPrompt } from './orchestrator';
export type { AgentDefinition, AgentOrchestrationOptions } from './types';

import { BUILT_IN_AGENTS } from './presets';
import { loadCustomAgents } from '../loader/custom-agent-loader';
import type { AgentDefinition } from './types';

/**
 * 获取所有活跃 Agent（内置 + 用户自定义 .ethan/agents/）
 * 自定义 Agent 同 id 覆盖内置 Agent
 */
export function getActiveAgents(cwd?: string): AgentDefinition[] {
  const custom = loadCustomAgents(cwd ?? process.cwd());
  if (custom.length === 0) return BUILT_IN_AGENTS;

  const merged = [...BUILT_IN_AGENTS];
  for (const ca of custom) {
    const idx = merged.findIndex((a) => a.id === ca.id);
    if (idx >= 0) {
      merged[idx] = ca; // override
    } else {
      merged.push(ca);
    }
  }
  return merged;
}
