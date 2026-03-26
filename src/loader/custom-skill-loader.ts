/**
 * 自定义 Skill 加载器
 * 从项目的 .ethan/skills/ 目录加载用户自定义 Skill（YAML、JSON 或 Markdown 格式）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillDefinition } from '../skills/types';

const CUSTOM_SKILLS_DIR = '.ethan/skills';

/**
 * 从指定目录加载自定义 Skill 定义
 * 支持 .yaml、.yml、.json、.md 格式
 */
export function loadCustomSkills(cwd: string = process.cwd()): SkillDefinition[] {
  const skillsDir = path.join(cwd, CUSTOM_SKILLS_DIR);
  if (!fs.existsSync(skillsDir)) return [];

  const files = fs.readdirSync(skillsDir).filter((f) => /\.(ya?ml|json|md)$/i.test(f));

  const skills: SkillDefinition[] = [];

  for (const file of files) {
    const filePath = path.join(skillsDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');

      if (/\.md$/i.test(file)) {
        // .md 格式：YAML frontmatter + Markdown body 步骤
        const skill = parseMdSkill(raw, file);
        if (skill) skills.push(skill);
        continue;
      }

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

/**
 * 生成自定义 Skill 的 Markdown 模板文件
 * 格式：YAML frontmatter（元数据）+ Markdown 正文（步骤，每个 ## 标题为一步）
 */
export function generateMdSkillTemplate(): string {
  return `---
id: my-custom-skill
name: 自定义技能
nameEn: my_custom_skill
description: 一句话描述这个 Skill 的作用
detailDescription: 详细描述（可选，用于规则文件头部）
triggers:
  - 自定义触发词
  - custom skill
  - '@ethan custom'
outputFormat: 描述输出格式（如：Markdown 文档、JSON 数据等）
category: 质量侧
order: 100
notes:
  - 使用注意事项（可选）
---

## 1. 第一步标题

- 步骤详细说明
- 支持任意 Markdown 格式

**重点内容**可以加粗，也可以使用代码块：

\`\`\`
示例代码
\`\`\`

## 2. 第二步标题

继续描述步骤内容...
`;
}

/**
 * 解析 .md 格式的 Skill 文件
 * 格式：YAML frontmatter（元数据）+ Markdown 正文（## 标题为步骤）
 */
function parseMdSkill(raw: string, filename: string): SkillDefinition | null {
  const fmMatch = raw.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    console.warn(`  ⚠️  ${filename}: .md Skill 必须以 YAML frontmatter 开头（--- ... ---）`);
    return null;
  }

  let meta: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('js-yaml') as { load: (s: string) => unknown };
    meta = yaml.load(fmMatch[1]);
  } catch (err) {
    console.warn(`  ⚠️  ${filename}: YAML frontmatter 解析失败 — ${(err as Error).message}`);
    return null;
  }

  if (typeof meta !== 'object' || meta === null) {
    console.warn(`  ⚠️  ${filename}: frontmatter 必须是对象`);
    return null;
  }

  const body = fmMatch[2].trim();
  const mdSteps = parseMdSteps(body);

  // body 中的步骤优先；若 body 无 ## 标题则 fallback 到 frontmatter.steps
  const data: Record<string, unknown> = {
    ...(meta as Record<string, unknown>),
    ...(mdSteps.length > 0 ? { steps: mdSteps } : {}),
  };

  return validateCustomSkill(data, filename);
}

/**
 * 从 Markdown 正文中提取步骤
 * 每个 ## 或 ### 标题 → 一个步骤（title = 标题文字，content = 标题到下一标题前的内容）
 */
function parseMdSteps(body: string): Array<{ title: string; content: string }> {
  const steps: Array<{ title: string; content: string }> = [];
  if (!body) return steps;

  const lines = body.split(/\r?\n/);
  let currentTitle = '';
  const currentContent: string[] = [];

  const flush = () => {
    if (currentTitle) {
      steps.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      currentContent.length = 0;
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  flush();
  return steps;
}
