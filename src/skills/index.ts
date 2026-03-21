/**
 * 单一数据源入口
 * 构建脚本和运行时均从此文件取数据
 */

export { requirementSkill } from './01-requirement';
export { taskBreakdownSkill } from './02-task-breakdown';
export { designSkill } from './03-design';
export { implementationSkill } from './04-implementation';
export { progressTrackingSkill } from './05-progress-tracking';
export { taskReportSkill } from './06-task-report';
export { weeklyReportSkill } from './07-weekly-report';
export { codeReviewSkill } from './08-code-review';
export { debugSkill } from './09-debug';
export { techResearchSkill } from './10-tech-research';

export type { SkillDefinition, SkillStep, SkillExample, Platform, BuildContext, PipelineDefinition } from './types';

import { requirementSkill } from './01-requirement';
import { taskBreakdownSkill } from './02-task-breakdown';
import { designSkill } from './03-design';
import { implementationSkill } from './04-implementation';
import { progressTrackingSkill } from './05-progress-tracking';
import { taskReportSkill } from './06-task-report';
import { weeklyReportSkill } from './07-weekly-report';
import { codeReviewSkill } from './08-code-review';
import { debugSkill } from './09-debug';
import { techResearchSkill } from './10-tech-research';

/** 所有 Skill 按顺序排列 */
export const ALL_SKILLS = [
  requirementSkill,
  taskBreakdownSkill,
  designSkill,
  implementationSkill,
  progressTrackingSkill,
  taskReportSkill,
  weeklyReportSkill,
  codeReviewSkill,
  debugSkill,
  techResearchSkill,
];
