/**
 * 自定义 Skill 加载器
 * 从项目的 .ethan/skills/ 目录加载用户自定义 Skill（YAML 或 JSON 格式）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillDefinition } from '../skills/types';

const CUSTOM_SKILLS_DIR = '.ethan/skills';

/**
 * 从指定目录加载自定义 Skill 定义
 * 支持 .yaml、.yml、.json 格式
 */
export function loadCustomSkills(cwd: string = process.cwd()): SkillDefinition[] {
  const skillsDir = path.join(cwd, CUSTOM_SKILLS_DIR);
  if (!fs.existsSync(skillsDir)) return [];

  const files = fs.readdirSync(skillsDir).filter((f) => /\.(ya?ml|json)$/i.test(f));

  const skills: SkillDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(skillsDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      let data: unknown;

      if (/\.json$/i.test(file)) {
        data = JSON.parse(raw);
      } else {
        // 动态加载 js-yaml（运行时依赖）
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const yaml = require('js-yaml') as { load: (s: string) => unknown };
        data = yaml.load(raw);
      }

      const skill = validateCustomSkill(data, file);
      if (skill) {
        skills.push(skill);
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to load custom skill: ${file} — ${(err as Error).message}`);
    }
  }

  return skills;
}

/**
 * 验证自定义 Skill 数据结构，返回合法的 SkillDefinition 或 null
 */
function validateCustomSkill(data: unknown, filename: string): SkillDefinition | null {
  if (typeof data !== 'object' || data === null) {
    console.warn(`  ⚠️  ${filename}: root must be an object`);
    return null;
  }

  const d = data as Record<string, unknown>;

  const required = ['id', 'name', 'nameEn', 'description', 'triggers', 'steps', 'outputFormat'];
  for (const key of required) {
    if (!d[key]) {
      console.warn(`  ⚠️  ${filename}: missing required field "${key}"`);
      return null;
    }
  }

  if (!Array.isArray(d.triggers) || (d.triggers as unknown[]).length === 0) {
    console.warn(`  ⚠️  ${filename}: "triggers" must be a non-empty array`);
    return null;
  }

  if (!Array.isArray(d.steps) || (d.steps as unknown[]).length === 0) {
    console.warn(`  ⚠️  ${filename}: "steps" must be a non-empty array`);
    return null;
  }

  // 验证 steps 格式
  const steps = (d.steps as Record<string, unknown>[]).map((step, i) => {
    if (!step.title || !step.content) {
      throw new Error(`step[${i}] must have "title" and "content"`);
    }
    return { title: String(step.title), content: String(step.content) };
  });

  return {
    id: String(d.id),
    name: String(d.name),
    nameEn: String(d.nameEn),
    description: String(d.description),
    descriptionEn: d.descriptionEn ? String(d.descriptionEn) : undefined,
    detailDescription: d.detailDescription ? String(d.detailDescription) : String(d.description),
    triggers: (d.triggers as unknown[]).map(String),
    steps,
    outputFormat: String(d.outputFormat),
    order: typeof d.order === 'number' ? d.order : 100,
    category: d.category as SkillDefinition['category'] | undefined,
    nextSkill: d.nextSkill ? String(d.nextSkill) : undefined,
    notes: Array.isArray(d.notes) ? (d.notes as unknown[]).map(String) : undefined,
  };
}

/**
 * 生成自定义 Skill 的 YAML 模板文件
 */
export function generateSkillTemplate(): string {
  return `# Ethan 自定义 Skill 模板
# 字段说明见 https://github.com/aokiz-ek/smart-flow-skill

id: my-custom-skill          # 唯一标识符（用于路由和统计）
name: 自定义技能              # 显示名称（中文）
nameEn: my_custom_skill       # 英文名称（下划线分隔）
description: 一句话描述这个 Skill 的作用
detailDescription: 详细描述（可选，用于规则文件头部）
triggers:
  - 自定义触发词
  - custom skill
  - '@ethan custom'
steps:
  - title: 1. 第一步标题
    content: |
      - 步骤详细说明
      - 支持 Markdown 格式
  - title: 2. 第二步标题
    content: |
      - 步骤详细说明
outputFormat: 描述输出格式（如：Markdown 文档、JSON 数据等）
category: 质量侧              # 可选：需求侧 | 执行侧 | 跟踪侧 | 输出侧 | 质量侧
order: 100                    # 排序序号（自定义 Skill 建议从 100 开始）
notes:
  - 使用注意事项（可选）
`;
}
