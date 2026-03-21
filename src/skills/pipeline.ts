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
];

/**
 * 根据 pipeline id 解析出 pipeline 定义和对应的 Skill 列表
 */
export function resolvePipeline(
  id: string
): { pipeline: PipelineDefinition; skills: SkillDefinition[] } | null {
  const pipeline = PIPELINES.find((p) => p.id === id);
  if (!pipeline) return null;

  const skills = pipeline.skillIds
    .map((skillId) => ALL_SKILLS.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);

  return { pipeline, skills };
}
