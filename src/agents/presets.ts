/**
 * 内置 Agent 预设定义
 * 8 个标准 Agent：5 个通用 + 3 个专业化（QA / Security / Data）
 */

import type { AgentDefinition } from './types';

export const BUILT_IN_AGENTS: AgentDefinition[] = [
  {
    id: 'architect',
    name: 'Architect Agent',
    nameEn: 'architect-agent',
    emoji: '🏗️',
    role: '负责需求分析、系统设计、接口设计与技术方案',
    skillIds: [
      'requirement-understanding',
      'task-breakdown',
      'solution-design',
      'api-design',
      'system-design',
      'prd',
      'spec-proposal',
    ],
  },
  {
    id: 'coder',
    name: 'Code Agent',
    nameEn: 'code-agent',
    emoji: '💻',
    role: '负责代码实现、单元测试、重构与设计模式应用',
    skillIds: [
      'implementation',
      'unit-testing',
      'refactoring',
      'design-patterns',
      'database-optimize',
      'api-mock',
      'data-migration',
      'llm-feature',
    ],
  },
  {
    id: 'reviewer',
    name: 'Review Agent',
    nameEn: 'review-agent',
    emoji: '🔍',
    role: '负责代码审查、安全审查、Spec 对齐验证与 Git 规范',
    skillIds: [
      'code-review',
      'security-review',
      'spec-review',
      'git-workflow',
      'threat-model',
      'mobile-review',
      'tech-debt',
    ],
  },
  {
    id: 'devops',
    name: 'DevOps Agent',
    nameEn: 'devops-agent',
    emoji: '🚀',
    role: '负责部署上线、容器化、CI/CD、可观测性与性能优化',
    skillIds: [
      'deployment',
      'docker',
      'cicd',
      'observability',
      'performance',
      'green-code',
      'data-pipeline',
      'ml-experiment',
    ],
  },
  {
    id: 'pm',
    name: 'PM Agent',
    nameEn: 'pm-agent',
    emoji: '📊',
    role: '负责进度跟踪、任务报告、周报生成、技术调研与故障排查',
    skillIds: [
      'progress-tracking',
      'task-report',
      'weekly-report',
      'tech-research',
      'debug',
      'service-catalog',
    ],
  },
  // ── 专业化 Agent（可按需在 Pipeline 中独立使用）──────────────────────────
  {
    id: 'qa',
    name: 'QA Agent',
    nameEn: 'qa-agent',
    emoji: '🧪',
    role: '负责质量保障：单元测试、代码审查、Spec 审查与移动端合规',
    skillIds: [
      'unit-testing',
      'code-review',
      'spec-review',
      'mobile-review',
      'security-review',
    ],
  },
  {
    id: 'security',
    name: 'Security Agent',
    nameEn: 'security-agent',
    emoji: '🔐',
    role: '负责安全专项：威胁建模、安全审查与安全变更提案',
    skillIds: [
      'threat-model',
      'security-review',
      'spec-proposal',
    ],
  },
  {
    id: 'data',
    name: 'Data Agent',
    nameEn: 'data-agent',
    emoji: '📈',
    role: '负责数据工程：数据管道、ML 实验、数据库优化与可观测性',
    skillIds: [
      'data-pipeline',
      'ml-experiment',
      'database-optimize',
      'observability',
      'llm-feature',
    ],
  },
];

/**
 * 构建 skillId → agentId 的路由映射表
 * 未匹配到任何 Agent 的 Skill 默认路由到 Code Agent
 */
export function buildSkillRouting(agents: AgentDefinition[]): Record<string, string> {
  const routing: Record<string, string> = {};
  for (const agent of agents) {
    for (const skillId of agent.skillIds) {
      routing[skillId] = agent.id;
    }
  }
  return routing;
}

/**
 * 找出参与此 Pipeline 的实际 Agent（按步骤顺序去重）
 */
export function getAgentsForPipeline(
  skillIds: string[],
  agents: AgentDefinition[],
  routing: Record<string, string>
): AgentDefinition[] {
  const seen = new Set<string>();
  const result: AgentDefinition[] = [];
  const fallback = agents.find((a) => a.id === 'coder') ?? agents[0];

  for (const skillId of skillIds) {
    const agentId = routing[skillId] ?? fallback.id;
    if (!seen.has(agentId)) {
      seen.add(agentId);
      const agent = agents.find((a) => a.id === agentId) ?? fallback;
      result.push(agent);
    }
  }
  return result;
}
