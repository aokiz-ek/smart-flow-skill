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
export { apiDesignSkill } from './11-api-design';
export { securityReviewSkill } from './12-security-review';
export { deploymentSkill } from './13-deployment';
export { prdSkill } from './14-prd';
export { gitWorkflowSkill } from './15-git-workflow';
export { unitTestingSkill } from './16-unit-testing';
export { systemDesignSkill } from './17-system-design';
export { databaseOptimizeSkill } from './18-database-optimize';
export { dockerSkill } from './19-docker';
export { cicdSkill } from './20-cicd';
export { performanceSkill } from './21-performance';
export { refactoringSkill } from './22-refactoring';
export { observabilitySkill } from './23-observability';
export { designPatternsSkill } from './24-design-patterns';

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
import { apiDesignSkill } from './11-api-design';
import { securityReviewSkill } from './12-security-review';
import { deploymentSkill } from './13-deployment';
import { prdSkill } from './14-prd';
import { gitWorkflowSkill } from './15-git-workflow';
import { unitTestingSkill } from './16-unit-testing';
import { systemDesignSkill } from './17-system-design';
import { databaseOptimizeSkill } from './18-database-optimize';
import { dockerSkill } from './19-docker';
import { cicdSkill } from './20-cicd';
import { performanceSkill } from './21-performance';
import { refactoringSkill } from './22-refactoring';
import { observabilitySkill } from './23-observability';
import { designPatternsSkill } from './24-design-patterns';

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
  apiDesignSkill,
  securityReviewSkill,
  deploymentSkill,
  prdSkill,
  gitWorkflowSkill,
  unitTestingSkill,
  systemDesignSkill,
  databaseOptimizeSkill,
  dockerSkill,
  cicdSkill,
  performanceSkill,
  refactoringSkill,
  observabilitySkill,
  designPatternsSkill,
];
