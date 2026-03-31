/**
 * 自定义 Pipeline 加载器
 * 从项目的 .ethan/pipelines/ 目录加载用户自定义 Pipeline（YAML 或 JSON 格式）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PipelineDefinition } from '../skills/types';

const CUSTOM_PIPELINES_DIR = '.ethan/pipelines';

/**
 * 从指定目录加载自定义 Pipeline 定义
 * 支持 .yaml、.yml、.json 格式
 */
export function loadCustomPipelines(cwd: string = process.cwd()): PipelineDefinition[] {
  const pipelinesDir = path.join(cwd, CUSTOM_PIPELINES_DIR);
  if (!fs.existsSync(pipelinesDir)) return [];

  const files = fs.readdirSync(pipelinesDir).filter((f) => /\.(ya?ml|json)$/i.test(f));

  const pipelines: PipelineDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(pipelinesDir, file);
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

      const pipeline = validateCustomPipeline(data, file);
      if (pipeline) {
        pipelines.push(pipeline);
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to load custom pipeline: ${file} — ${(err as Error).message}`);
    }
  }

  return pipelines;
}

/**
 * 验证自定义 Pipeline 数据结构，返回合法的 PipelineDefinition 或 null
 */
function validateCustomPipeline(data: unknown, filename: string): PipelineDefinition | null {
  if (typeof data !== 'object' || data === null) {
    console.warn(`  ⚠️  ${filename}: root must be an object`);
    return null;
  }

  const d = data as Record<string, unknown>;

  const required = ['id', 'name', 'description', 'skillIds'];
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
    description: String(d.description),
    skillIds: (d.skillIds as unknown[]).map(String),
  };
}

/**
 * 生成自定义 Pipeline 的 YAML 模板文件
 */
export function generatePipelineTemplate(): string {
  return `# Ethan 自定义 Pipeline 模板
# Pipeline 是多个 Skill 的有序组合，支持链式工作流

id: my-pipeline              # 唯一标识符（用于 ethan pipeline run <id>）
name: 我的工作流              # 显示名称
description: 一句话描述这条 Pipeline 的用途

# skillIds: 按执行顺序填写 Skill ID
# 可用内置 Skill ID:
#   requirement-understanding, task-breakdown, solution-design,
#   implementation, progress-tracking, task-report, weekly-report,
#   code-review, debug, tech-research,
#   api-design, security-review, deployment, prd
# 也可以使用自定义 Skill 的 ID（需先在 .ethan/skills/ 中定义）
skillIds:
  - requirement-understanding
  - solution-design
  - implementation
  - code-review
`;
}
