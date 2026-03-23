import type { SkillDefinition, BuildContext } from '../skills/types';

/** 取技能描述：有英文版且当前语言为 en 则用英文 */
function desc(skill: SkillDefinition, isEn: boolean): string {
  return isEn && skill.descriptionEn ? skill.descriptionEn : skill.description;
}

/** 取技能显示名：英文时用 nameEn（下划线→空格），中文时用 name */
function skillName(skill: SkillDefinition, isEn: boolean): string {
  return isEn ? skill.nameEn.replace(/_/g, ' ') : skill.name;
}

/**
 * 生成各平台 Markdown 规则文件
 * 支持：copilot、cline、lingma、codebuddy、windsurf、zed、jetbrains、continue、claude-code
 */
export function renderMarkdown(ctx: BuildContext): string {
  switch (ctx.platform) {
    case 'copilot':
      return renderCopilot(ctx);
    case 'cline':
      return renderCline(ctx);
    case 'lingma':
      return renderLingma(ctx);
    case 'codebuddy':
      return renderCodeBuddy(ctx);
    case 'windsurf':
      return renderWindsurf(ctx);
    case 'zed':
      return renderZed(ctx);
    case 'jetbrains':
      return renderJetBrains(ctx);
    case 'continue':
      return renderContinue(ctx);
    case 'claude-code':
      return renderClaudeCode(ctx);
    case 'cursor-new':
    case 'cursor-old':
      // Cursor uses dedicated cursor-mdc.template.ts
      return renderCopilot(ctx);
  }
}

/** VS Code Copilot：.github/copilot-instructions.md */
function renderCopilot(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  return `# Ethan - Copilot Instructions (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

## IMPORTANT: Skill Activation Rules

You are equipped with the **Ethan AI Workflow Assistant**. Follow these rules strictly:

1. **Trigger detection**: At the start of every user message, scan for trigger keywords listed in each Skill. If a match is found, **immediately activate that Skill** — do not ask for confirmation.
2. **Full execution**: Execute **every step in order**. Do not skip, summarize, or abbreviate steps.
3. **Exact output**: Output must follow each Skill's defined format template exactly.
4. **Direct activation**: When the user explicitly names a Skill (e.g. "代码审查", "code review", "需求理解"), activate it immediately without any preamble.
5. **Ambiguity resolution**: When multiple triggers match, activate the most specific Skill. When in doubt, ask the user to confirm which Skill to run.

## Available Skills

${skills.map((s) => renderCopilotSkill(s, isEn)).join('\n\n')}
`;
}

function renderCopilotSkill(skill: SkillDefinition, isEn: boolean): string {
  const steps = skill.steps
    .map((step, i) => {
      const title = step.title.replace(/^\d+\.\s*/, '');
      const lines = step.content.trim().split('\n').map((l) => `   ${l}`).join('\n');
      return `${i + 1}. **${title}**:\n${lines}`;
    })
    .join('\n\n');

  const notesLine =
    skill.notes && skill.notes.length > 0
      ? `\n**Notes**: ${skill.notes.map((n) => `\n- ${n}`).join('')}`
      : '';

  return `### ${skill.order}. ${skillName(skill, isEn)} (${skill.nameEn})

**Triggers**: ${skill.triggers.map((t) => `\`${t}\``).join(', ')}

**Goal**: ${desc(skill, isEn)}

**Steps**:

${steps}

**Output**: ${skill.outputFormat}${notesLine}`;
}

/** Cline：.clinerules */
function renderCline(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';
  const skillsContent = skills.map((s) => renderClineSkill(s, isEn)).join('\n\n');

  const activationRules = isEn
    ? `## IMPORTANT: Skill Activation Rules

1. At the start of every user message, scan for trigger keywords. If matched, **immediately activate that Skill**.
2. Execute **every step in order** — do not skip or abbreviate any step.
3. Output must follow each Skill's defined format template exactly.
4. When the user names a Skill directly, activate it immediately without any preamble.

`
    : `## 重要：Skill 激活规则

1. 每条用户消息开头，扫描触发词列表。匹配到任意触发词后，**立即激活对应 Skill**，无需确认。
2. **按步骤顺序全部执行**，不跳步、不缩减、不省略。
3. 输出严格遵循各 Skill 的格式模板。
4. 用户明确说出 Skill 名称时，直接执行，无需前置确认。

`;

  if (isEn) {
    return `# Ethan v${version}
# Generated: ${generatedAt}

Ethan - Your AI Workflow Assistant. When you see any trigger keyword below, execute the corresponding skill workflow.

${activationRules}## Skill Triggers
${skills.map((s) => `- **${skillName(s, true)}**: ${s.triggers.slice(0, 4).join(' | ')}`).join('\n')}

---

${skillsContent}

---
Rules: Follow steps in order. Do not skip. Output per skill template.
`;
  }

  return `# Ethan v${version}
# Generated: ${generatedAt}
# Source: https://github.com/aokiz-ek/smart-flow-skill

Ethan。当用户输入以下触发词时，按对应 Skill 的步骤执行。

${activationRules}## 触发词总览
${skills.map((s) => `- **${s.name}**: ${s.triggers.slice(0, 4).join(' | ')}`).join('\n')}

---

${skillsContent}

---
规则：严格按步骤执行，不跳步，输出遵循各 Skill 的格式模板。
`;
}

function renderClineSkill(skill: SkillDefinition, isEn: boolean): string {
  const stepsContent = skill.steps.map((step) => `${step.title}\n${step.content}`).join('\n\n');
  if (isEn) {
    return `## ${skillName(skill, true)} (${skill.id})

Triggers: ${skill.triggers.slice(0, 4).join(' | ')}
Goal: ${desc(skill, true)}

${stepsContent}

Output: ${skill.outputFormat}`;
  }
  return `## ${skill.name}

触发：${skill.triggers.slice(0, 4).join(' | ')}
说明：${skill.description}

${stepsContent}

输出格式：${skill.outputFormat}`;
}

/** 通义灵码：.lingma/rules/*.md */
function renderLingma(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  const activationRules = isEn
    ? `## IMPORTANT: Skill Activation Rules

1. At the start of every user message, scan for trigger keywords. If matched, **immediately activate that Skill** — no confirmation needed.
2. Execute **every step in order** with full detail — do not skip or abbreviate.
3. Output must follow each Skill's defined format template exactly.
4. When the user names a Skill directly, activate it immediately.

`
    : `## 重要：Skill 激活规则

1. 每条用户消息开头扫描触发词，匹配后**立即激活对应 Skill**，无需确认。
2. **按步骤顺序逐步完整执行**，不跳步、不缩减、不省略。
3. 输出严格遵循各 Skill 的格式模板。
4. 用户明确说出 Skill 名称时，直接执行。

`;

  if (isEn) {
    return `# Ethan v${version}

> Generated: ${generatedAt}

## Overview

${skills.length} standardized workflow skills. Match trigger keywords to execute the corresponding workflow.

${activationRules}## Skill List

${skills.map((s) => renderLingmaSkill(s, true)).join('\n\n---\n\n')}
`;
  }

  return `# Ethan v${version}

> 生成时间：${generatedAt}

## 功能说明

本规则提供 ${skills.length} 个标准化工作流节点（Skill），AI 助手根据用户输入的触发词自动执行对应流程。

${activationRules}## Skill 列表

${skills.map((s) => renderLingmaSkill(s, false)).join('\n\n---\n\n')}
`;
}

function renderLingmaSkill(skill: SkillDefinition, isEn: boolean): string {
  const triggers = isEn
    ? skill.triggers.slice(0, 5).join(', ')
    : skill.triggers.slice(0, 5).join('、');

  const stepsContent = skill.steps
    .map((step, i) => {
      const title = step.title.replace(/^\d+\.\s*/, '');
      const lines = step.content.trim().split('\n').map((l) => `   ${l}`).join('\n');
      return `${i + 1}. **${title}**\n${lines}`;
    })
    .join('\n\n');

  const notesLine =
    skill.notes && skill.notes.length > 0
      ? `\n\n**${isEn ? 'Notes' : '注意事项'}**：\n${skill.notes.map((n) => `- ${n}`).join('\n')}`
      : '';

  if (isEn) {
    return `### ${skill.order}. ${skillName(skill, true)}

- **Triggers**: ${triggers}
- **Goal**: ${desc(skill, true)}

**Steps**:

${stepsContent}

**Output**: ${skill.outputFormat}${notesLine}`;
  }

  return `### ${skill.order}. ${skill.name}

- **触发词**：${triggers}
- **目标**：${skill.description}

**步骤**：

${stepsContent}

**输出格式**：${skill.outputFormat}${notesLine}`;
}

/** 腾讯 CodeBuddy：CODEBUDDY.md */
function renderCodeBuddy(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  const activationRules = isEn
    ? `## IMPORTANT: Skill Activation Rules

1. At the start of every user message, scan for trigger keywords. If matched, **immediately activate that Skill** — no confirmation needed.
2. Execute **every step in order** with full detail — do not skip or abbreviate.
3. Output must follow each Skill's defined format template exactly.
4. When the user names a Skill directly, activate it immediately.

`
    : `## 重要：Skill 激活规则

1. 每条用户消息开头扫描触发词，匹配后**立即激活对应 Skill**，无需确认。
2. **按步骤顺序逐步完整执行**，不跳步、不缩减。
3. 输出严格遵循各 Skill 的格式模板。
4. 用户明确说出 Skill 名称时，直接执行。

`;

  return `# Ethan v${version}

Ethan - Your AI Workflow Assistant | Generated: ${generatedAt}

${activationRules}## Skills

${skills.map((s) => renderCodeBuddySkill(s, isEn)).join('\n\n---\n\n')}
`;
}

function renderCodeBuddySkill(skill: SkillDefinition, isEn: boolean): string {
  const stepsContent = skill.steps
    .map((step, i) => {
      const title = step.title.replace(/^\d+\.\s*/, '');
      const lines = step.content.trim().split('\n').map((l) => `   ${l}`).join('\n');
      return `${i + 1}. **${title}**\n${lines}`;
    })
    .join('\n\n');

  const notesLine =
    skill.notes && skill.notes.length > 0
      ? `\n\n**${isEn ? 'Notes' : '注意事项'}**：\n${skill.notes.map((n) => `- ${n}`).join('\n')}`
      : '';

  if (isEn) {
    return `### ${skill.order}. ${skillName(skill, true)}

**Triggers**: ${skill.triggers.slice(0, 4).join(' / ')}

**Goal**: ${desc(skill, true)}

**Steps**:

${stepsContent}

**Output**: ${skill.outputFormat}${notesLine}`;
  }

  return `### ${skill.order}. ${skill.name}

**触发词**：${skill.triggers.slice(0, 4).join(' / ')}

**目标**：${skill.description}

**步骤**：

${stepsContent}

**输出格式**：${skill.outputFormat}${notesLine}`;
}

/** Windsurf：.windsurf/rules/smart-flow.md（YAML frontmatter + 强激活指令） */
function renderWindsurf(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  return `---
description: Ethan AI Workflow Assistant — ${skills.length} standardized workflow skills
globs: ["**/*"]
alwaysApply: true
---

# Ethan - Windsurf Rules (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

## IMPORTANT: Skill Activation Rules

You are equipped with the **Ethan AI Workflow Assistant**. Follow these rules strictly:

1. **Trigger detection**: At the start of every user message, scan for trigger keywords listed in each Skill. If a match is found, **immediately activate that Skill** — do not ask for confirmation.
2. **Full execution**: Execute **every step in order**. Do not skip, summarize, or abbreviate steps.
3. **Exact output**: Output must follow each Skill's defined format template exactly.
4. **Direct activation**: When the user explicitly names a Skill, activate it immediately without any preamble.

## Available Skills

${skills.map((s) => renderCopilotSkill(s, isEn)).join('\n\n')}
`;
}

/** Zed：smart-flow.rules（纯文本，包含完整步骤内容） */
function renderZed(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  const skillLines = skills
    .map((s) => {
      const stepsContent = s.steps
        .map((step, i) => {
          const title = step.title.replace(/^\d+\.\s*/, '');
          const lines = step.content.trim().split('\n').map((l) => `      ${l}`).join('\n');
          return `   ${i + 1}. ${title}\n${lines}`;
        })
        .join('\n\n');

      return `${s.order}. ${skillName(s, isEn)} [${s.triggers.slice(0, 3).join('/')}]
   ${desc(s, isEn)}

${stepsContent}

   Output: ${s.outputFormat}`;
    })
    .join('\n\n' + '-'.repeat(60) + '\n\n');

  return `Ethan v${version} | ${generatedAt}

Workflow automation assistant. IMPORTANT: When user message matches a trigger keyword below, immediately activate that skill and execute ALL steps in order. Do not skip steps. Output per skill template.

${'='.repeat(60)}

${skillLines}

${'='.repeat(60)}

Rules:
- Scan trigger keywords at start of every message
- Immediately activate matching Skill — no confirmation needed
- Execute every step with full detail
- Output follows each Skill's defined template
`;
}

/** JetBrains AI：.github/ai-instructions.md（类 Copilot） */
function renderJetBrains(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  return `# Ethan - JetBrains AI Instructions (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

## IMPORTANT: Skill Activation Rules

You are equipped with the **Ethan AI Workflow Assistant**. Follow these rules strictly:

1. **Trigger detection**: At the start of every user message, scan for trigger keywords listed in each Skill. If a match is found, **immediately activate that Skill** — do not ask for confirmation.
2. **Full execution**: Execute **every step in order**. Do not skip, summarize, or abbreviate steps.
3. **Exact output**: Output must follow each Skill's defined format template exactly.
4. **Direct activation**: When the user explicitly names a Skill, activate it immediately without any preamble.

## Available Skills

${skills.map((s) => renderCopilotSkill(s, isEn)).join('\n\n')}
`;
}

/** Continue：.continuerules（类 Cline 格式） */
function renderContinue(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';
  const skillsContent = skills.map((s) => renderClineSkill(s, isEn)).join('\n\n');

  const activationRules = isEn
    ? `## IMPORTANT: Skill Activation Rules

1. At the start of every user message, scan for trigger keywords. If matched, **immediately activate that Skill**.
2. Execute **every step in order** — do not skip or abbreviate any step.
3. Output must follow each Skill's defined format template exactly.
4. When the user names a Skill directly, activate it immediately without any preamble.

`
    : `## 重要：Skill 激活规则

1. 每条用户消息开头，扫描触发词列表。匹配到任意触发词后，**立即激活对应 Skill**，无需确认。
2. **按步骤顺序全部执行**，不跳步、不缩减、不省略。
3. 输出严格遵循各 Skill 的格式模板。
4. 用户明确说出 Skill 名称时，直接执行，无需前置确认。

`;

  if (isEn) {
    return `# Ethan v${version}
# Generated: ${generatedAt}

Ethan (Continue). Execute the matching skill workflow when trigger keywords are detected.

${activationRules}## Skill Triggers
${skills.map((s) => `- **${skillName(s, true)}**: ${s.triggers.slice(0, 4).join(' | ')}`).join('\n')}

---

${skillsContent}

---
Rules: Follow steps in order. Output per skill template.
`;
  }

  return `# Ethan v${version}
# Generated: ${generatedAt}
# Source: https://github.com/aokiz-ek/smart-flow-skill

Ethan（Continue）。当用户输入以下触发词时，按对应 Skill 的步骤执行。

${activationRules}## 触发词总览
${skills.map((s) => `- **${s.name}**: ${s.triggers.slice(0, 4).join(' | ')}`).join('\n')}

---

${skillsContent}

---
规则：严格按步骤执行，不跳步，输出遵循各 Skill 的格式模板。
`;
}

/** Claude Code：CLAUDE.md（详细步骤格式，充分利用长上下文） */
function renderClaudeCode(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  const skillsContent = skills
    .map((s) => {
      const stepsContent = s.steps
        .map((step) => `#### ${step.title}\n\n${step.content}`)
        .join('\n\n');

      const triggersLine = s.triggers.map((t) => `\`${t}\``).join(', ');
      const notesLine =
        s.notes && s.notes.length > 0
          ? `\n\n**${isEn ? 'Notes' : '注意事项'}**:\n${s.notes.map((n) => `- ${n}`).join('\n')}`
          : '';

      return `### ${s.order}. ${skillName(s, isEn)} (\`${s.id}\`)

**${isEn ? 'Description' : '描述'}**: ${desc(s, isEn)}

**${isEn ? 'Triggers' : '触发词'}**: ${triggersLine}

**执行步骤**:

${stepsContent}

**输出格式**: ${s.outputFormat}${notesLine}`;
    })
    .join('\n\n---\n\n');

  return `# Ethan v${version}

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually. Source: src/skills/

## Ethan

本文件配置了 ${skills.length} 个标准化工作流节点（Skill）。当用户输入触发词时，严格按对应 Skill 的步骤执行，输出遵循各 Skill 的格式模板。

## 执行原则

1. 对话开始时检测用户意图，匹配触发词，确定要执行的 Skill
2. 严格按 Skill 定义的步骤顺序执行，**不跳步、不省略**
3. 输出格式严格遵循各 Skill 的模板定义
4. 用户明确指定 Skill 名称时，直接执行，无需确认
5. 当前 Skill 完成后，根据 nextSkill 提示用户进入下一个环节

## Skills 详细定义

${skillsContent}

---

*Ethan - Your AI Workflow Assistant | 让每一步都有据可依*
`;
}
