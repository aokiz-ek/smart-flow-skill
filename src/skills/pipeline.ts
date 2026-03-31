/**
 * Pipeline 定义（链式 Skill 组合）
 * ⚠️ 此文件只能被 cli/index.ts 和 mcp/server.ts 导入
 * index.ts 不得导入此文件（防循环依赖）
 */

import type { PipelineDefinition, SkillDefinition } from './types';
import { ALL_SKILLS } from './index';

export const PIPELINES: PipelineDefinition[] = [
  {
    id: 'dev-workflow',
    name: '开发工作流',
    description: '完整的需求开发流程：需求理解 → 任务拆解 → 方案设计 → 执行实现',
    skillIds: [
      'requirement-understanding',
      'task-breakdown',
      'solution-design',
      'implementation',
    ],
  },
  {
    id: 'reporting',
    name: '汇报工作流',
    description: '完整的汇报流程：进度跟踪 → 任务报告 → 周报生成',
    skillIds: [
      'progress-tracking',
      'task-report',
      'weekly-report',
    ],
  },
  {
    id: 'quality-workflow',
    name: '质量保障工作流',
    description: '代码质量和问题处理流程：代码审查 → 故障排查',
    skillIds: [
      'code-review',
      'debug',
    ],
  },
  {
    id: 'full-dev-cycle',
    name: '完整开发周期',
    description: '端到端研发流程：需求理解 → 接口设计 → 方案设计 → 执行实现 → 代码审查 → 部署上线',
    skillIds: [
      'requirement-understanding',
      'api-design',
      'solution-design',
      'implementation',
      'code-review',
      'deployment',
    ],
  },
  {
    id: 'incident-response',
    name: '故障响应工作流',
    description: '线上故障处理流程：故障排查 → 技术复盘 → 任务报告',
    skillIds: [
      'debug',
      'tech-research',
      'task-report',
    ],
  },
  {
    id: 'new-feature',
    name: '新功能工作流',
    description: '新功能完整交付流程：PRD → 技术调研 → 接口设计 → 任务拆解 → 执行实现',
    skillIds: [
      'prd',
      'tech-research',
      'api-design',
      'task-breakdown',
      'implementation',
    ],
  },
];

/**
 * 根据 pipeline id 解析出 pipeline 定义和对应的 Skill 列表
 * 优先查内置 Pipeline，其次查自定义 Pipeline（.ethan/pipelines/）
 */
export function resolvePipeline(
  id: string,
  customPipelines?: PipelineDefinition[],
  allSkills?: SkillDefinition[]
): { pipeline: PipelineDefinition; skills: SkillDefinition[] } | null {
  const skillPool = allSkills ?? ALL_SKILLS;
  const allPipelines = [...PIPELINES, ...(customPipelines ?? [])];
  const pipeline = allPipelines.find((p) => p.id === id);
  if (!pipeline) return null;

  const skills = pipeline.skillIds
    .map((skillId) => skillPool.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);

  return { pipeline, skills };
}
