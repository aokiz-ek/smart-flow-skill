import type { SkillDefinition, BuildContext } from '../skills/types';

/**
 * 生成 Cursor 新版 .mdc 文件内容（含 YAML frontmatter）
 */
export function renderCursorMdc(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;

  const skillsContent = skills.map(renderSkillSection).join('\n\n---\n\n');

  return `---
description: Ethan - Your AI Workflow Assistant
globs:
alwaysApply: true
---

# Ethan v${version}

> 自动生成 - 请勿手动修改，源文件：src/skills/
> Generated at: ${generatedAt}

本 Skill 提供 ${skills.length} 个标准化工作流节点，通过触发词激活对应的执行流程。

## 快速触发指南

| Skill | 主要触发词 |
|-------|-----------|
${skills.map((s) => `| ${s.name} | \`${s.triggers[0]}\` |`).join('\n')}

---

${skillsContent}

---

## 通用规则

- 每次对话开始时，检测用户意图，自动匹配最合适的 Skill
- 执行 Skill 前，先确认关键前提条件（如"需求理解"完成后才进入"任务拆解"）
- 输出严格按照各 Skill 定义的格式模板
- 如果用户明确指定 Skill 名称，直接执行，无需再次确认
`;
}

/**
 * 生成 Cursor 旧版 .cursorrules 文件（无 frontmatter）
 */
export function renderCursorOld(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const skillsContent = skills.map(renderSkillSection).join('\n\n---\n\n');

  return `# Ethan v${version}

> 自动生成 - 请勿手动修改，源文件：src/skills/
> Generated at: ${generatedAt}

## 触发词一览
${skills.map((s) => `- ${s.name}：${s.triggers.slice(0, 3).join('、')}`).join('\n')}

---

${skillsContent}

---

执行任何 Skill 时，严格按照定义的步骤和输出格式，不省略任何关键步骤。
`;
}

function renderSkillSection(skill: SkillDefinition): string {
  const stepsContent = skill.steps
    .map((step) => `### ${step.title}\n\n${step.content}`)
    .join('\n\n');

  const triggersStr = skill.triggers.map((t) => `\`${t}\``).join('、');

  let content = `## Skill ${skill.order}：${skill.name}

**触发词**：${triggersStr}

**描述**：${skill.description}

${stepsContent}

**输出格式**：${skill.outputFormat}`;

  if (skill.notes && skill.notes.length > 0) {
    content += `\n\n**注意事项**：\n${skill.notes.map((n) => `- ${n}`).join('\n')}`;
  }

  return content;
}
