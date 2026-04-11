import { describe, it, expect } from 'vitest';
import { buildMultiAgentPrompt } from './orchestrator';
import { BUILT_IN_AGENTS, buildSkillRouting, getAgentsForPipeline } from './presets';
import type { PipelineDefinition, SkillDefinition } from '../skills/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockSkills: SkillDefinition[] = [
  {
    id: 'requirement-understanding',
    name: '需求理解',
    nameEn: 'requirement_understanding',
    description: '深度解析用户需求，输出结构化需求文档',
    detailDescription: '深度解析',
    triggers: ['需求理解'],
    steps: [{ title: '1. 提取核心诉求', content: '用一句话总结业务目标' }],
    outputFormat: 'Markdown 结构化文档',
    order: 1,
  },
  {
    id: 'implementation',
    name: '执行实现',
    nameEn: 'implementation',
    description: '按设计方案逐步实现代码',
    detailDescription: '实现代码',
    triggers: ['执行实现'],
    steps: [{ title: '1. 确认实现前提', content: '确认设计方案已确认' }],
    outputFormat: '代码实现 + 自检清单',
    order: 4,
  },
  {
    id: 'code-review',
    name: '代码审查',
    nameEn: 'code_review',
    description: '系统性审查代码变更',
    detailDescription: '审查代码',
    triggers: ['代码审查'],
    steps: [{ title: '1. 理解变更意图', content: '阅读 PR 描述' }],
    outputFormat: 'Markdown 审查报告',
    order: 8,
  },
];

const mockPipeline: PipelineDefinition = {
  id: 'dev-workflow',
  name: '开发工作流',
  description: '需求理解 → 执行实现 → 代码审查',
  skillIds: ['requirement-understanding', 'implementation', 'code-review'],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildMultiAgentPrompt (zh)', () => {
  const prompt = buildMultiAgentPrompt(mockPipeline, mockSkills, BUILT_IN_AGENTS, {
    context: '开发用户登录功能',
    lang: 'zh',
  });

  it('contains pipeline name', () => {
    expect(prompt).toContain('开发工作流');
  });

  it('contains context', () => {
    expect(prompt).toContain('开发用户登录功能');
  });

  it('contains Agent roster table', () => {
    expect(prompt).toContain('Agent 阵容');
    expect(prompt).toContain('Architect Agent');
    expect(prompt).toContain('Code Agent');
    // dev-workflow uses architect+coder+pm (no reviewer/qa in this pipeline)
  });

  it('contains collaboration protocol', () => {
    expect(prompt).toContain('协作协议');
    expect(prompt).toContain('Handoff 摘要');
  });

  it('contains step headings with agent names', () => {
    expect(prompt).toContain('🏗️ Architect Agent');
    expect(prompt).toContain('💻 Code Agent');
  });

  it('contains handoff markers between different agents', () => {
    expect(prompt).toContain('Handoff →');
  });

  it('contains final report template', () => {
    expect(prompt).toContain('Multi-Agent 执行报告');
  });

  it('contains start command', () => {
    expect(prompt).toContain('立即开始执行');
  });
});

describe('buildMultiAgentPrompt (en)', () => {
  const prompt = buildMultiAgentPrompt(mockPipeline, mockSkills, BUILT_IN_AGENTS, {
    context: 'implement user login',
    lang: 'en',
  });

  it('contains English headers', () => {
    expect(prompt).toContain('Multi-Agent Orchestration');
    expect(prompt).toContain('Agent Roster');
    expect(prompt).toContain('Collaboration Protocol');
  });

  it('contains English start command', () => {
    expect(prompt).toContain('Begin:');
  });
});

describe('BUILT_IN_AGENTS', () => {
  it('has 8 agents', () => {
    expect(BUILT_IN_AGENTS).toHaveLength(8);
  });

  it('all agents have required fields', () => {
    for (const agent of BUILT_IN_AGENTS) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.emoji).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.skillIds.length).toBeGreaterThan(0);
    }
  });

  it('covers all 36 skills across agents', () => {
    const ALL_SKILL_IDS = [
      'requirement-understanding', 'task-breakdown', 'solution-design', 'implementation',
      'progress-tracking', 'task-report', 'weekly-report', 'code-review', 'debug',
      'tech-research', 'api-design', 'security-review', 'deployment', 'prd',
      'git-workflow', 'unit-testing', 'system-design', 'database-optimize', 'docker',
      'cicd', 'performance', 'refactoring', 'observability', 'design-patterns',
      'spec-proposal', 'spec-review', 'tech-debt', 'api-mock', 'data-migration',
      'llm-feature', 'threat-model', 'green-code', 'service-catalog', 'mobile-review',
      'data-pipeline', 'ml-experiment',
    ];

    const coveredIds = new Set(BUILT_IN_AGENTS.flatMap((a) => a.skillIds));
    const uncovered = ALL_SKILL_IDS.filter((id) => !coveredIds.has(id));
    expect(uncovered).toEqual([]);
  });
});

describe('buildSkillRouting', () => {
  it('maps each skillId to its agent', () => {
    const routing = buildSkillRouting(BUILT_IN_AGENTS);
    expect(routing['requirement-understanding']).toBe('architect');
    expect(routing['implementation']).toBe('coder');
    expect(routing['code-review']).toBe('qa');  // qa overrides reviewer (last-writer-wins)
    expect(routing['deployment']).toBe('devops');
    expect(routing['debug']).toBe('pm');
  });
});

describe('getAgentsForPipeline', () => {
  it('returns only agents participating in the pipeline', () => {
    const routing = buildSkillRouting(BUILT_IN_AGENTS);
    const agents = getAgentsForPipeline(
      ['requirement-understanding', 'implementation', 'code-review'],
      BUILT_IN_AGENTS,
      routing
    );
    expect(agents.map((a) => a.id)).toEqual(['architect', 'coder', 'qa']);
  });

  it('deduplicates consecutive same-agent steps', () => {
    const routing = buildSkillRouting(BUILT_IN_AGENTS);
    // Both solution-design and api-design belong to architect
    const agents = getAgentsForPipeline(
      ['requirement-understanding', 'solution-design', 'api-design'],
      BUILT_IN_AGENTS,
      routing
    );
    expect(agents.map((a) => a.id)).toEqual(['architect']); // deduped
  });
});
