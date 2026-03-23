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

## 重要：Skill 激活规则

本文件配置了 **Ethan AI 工作流助手**，严格遵守以下规则：

1. **触发检测**：每条用户消息开头，扫描下方触发词列表。匹配到任意触发词后，**立即激活对应 Skill**，无需二次确认。
2. **完整执行**：按 Skill 定义的步骤**逐步全部执行**，不跳步、不缩减、不省略。
3. **格式遵循**：输出严格遵循各 Skill 的格式模板。
4. **直接执行**：用户明确说出 Skill 名称时（如"代码审查"、"需求理解"），立即执行，无需前置确认。
5. **歧义处理**：多个触发词同时匹配时，激活最具体的 Skill；仍不确定时询问用户。

## 快速触发指南

| Skill | 主要触发词 |
|-------|-----------|
${skills.map((s) => `| ${s.name} | \`${s.triggers[0]}\` |`).join('\n')}

---

${skillsContent}

---

*Ethan - Your AI Workflow Assistant | 让每一步都有据可依*
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

## 重要：Skill 激活规则

1. 每条用户消息开头，扫描触发词列表。匹配到任意触发词后，**立即激活对应 Skill**，无需确认。
2. **按步骤顺序全部执行**，不跳步、不缩减、不省略。
3. 输出严格遵循各 Skill 的格式模板。
4. 用户明确说出 Skill 名称时，直接执行，无需前置确认。

## 触发词一览
${skills.map((s) => `- ${s.name}：${s.triggers.slice(0, 3).join('、')}`).join('\n')}

---

${skillsContent}

---

*Ethan - Your AI Workflow Assistant | 让每一步都有据可依*
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
