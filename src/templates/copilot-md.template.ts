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

/** 通义灵码：.lingma/rules/*.md（结构简洁） */
function renderLingma(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  if (isEn) {
    return `# Ethan v${version}

> Generated: ${generatedAt}

## Overview

${skills.length} standardized workflow skills. Match trigger keywords to execute the corresponding workflow.

## Skill List

${skills.map((s) => `### ${s.order}. ${skillName(s, true)}\n- **Triggers**: ${s.triggers.slice(0, 5).join(', ')}\n- **Goal**: ${desc(s, true)}\n- **Steps**: ${s.steps.map((step) => step.title.replace(/^\d+\.\s*/, '')).join(' → ')}`).join('\n\n')}

## Rules

1. Detect intent and match trigger keywords
2. Follow Skill steps in order
3. Output per skill template
`;
  }

  return `# Ethan v${version}

> 生成时间：${generatedAt}

## 功能说明

本规则提供 ${skills.length} 个标准化工作流节点（Skill），AI 助手根据用户输入的触发词自动执行对应流程。

## Skill 列表

${skills.map((s) => renderLingmaSkill(s)).join('\n\n')}

## 执行规则

1. 检测用户意图，匹配触发词
2. 严格按 Skill 定义的步骤执行
3. 输出遵循各 Skill 的格式模板
4. 上一个 Skill 完成后，提示用户进入下一个 Skill
`;
}

function renderLingmaSkill(skill: SkillDefinition): string {
  const triggers = skill.triggers.slice(0, 5).join('、');
  const stepsList = skill.steps
    .map((step) => `  - ${step.title}`)
    .join('\n');

  return `### ${skill.order}. ${skill.name}

- **触发词**：${triggers}
- **目标**：${skill.description}
- **步骤**：
${stepsList}
- **输出**：${skill.outputFormat}`;
}

/** 腾讯 CodeBuddy：CODEBUDDY.md（内容精简） */
function renderCodeBuddy(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  return `# Ethan v${version}

Ethan - Your AI Workflow Assistant | Generated: ${generatedAt}

## Skills

${skills
  .map(
    (s) => `### ${s.order}. ${skillName(s, isEn)}
${isEn ? 'Triggers' : '触发词'}：${s.triggers.slice(0, 3).join(' / ')}
${isEn ? 'Goal' : '说明'}：${desc(s, isEn)}
${isEn ? 'Steps' : '步骤'}：${s.steps.map((step) => step.title.replace(/^\d+\.\s*/, '')).join(' → ')}
${isEn ? 'Output' : '输出'}：${s.outputFormat}`
  )
  .join('\n\n')}

## ${isEn ? 'Rules' : '规则'}
- ${isEn ? 'Auto-match trigger keywords and execute the corresponding Skill' : '根据用户输入自动匹配触发词，执行对应 Skill'}
- ${isEn ? 'Follow steps in order without skipping' : '严格按步骤顺序执行，不省略关键步骤'}
- ${isEn ? 'Output per skill template' : '输出格式遵循各 Skill 模板定义'}
`;
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

/** Zed：smart-flow.rules（精简纯文本，无复杂 Markdown 结构） */
function renderZed(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const isEn = ctx.lang === 'en';

  const skillLines = skills
    .map(
      (s) =>
        `${s.order}. ${skillName(s, isEn)} [${s.triggers.slice(0, 3).join('/')}]\n   ${desc(s, isEn)}\n   Steps: ${s.steps.map((step) => step.title.replace(/^\d+\.\s*/, '')).join(' > ')}`
    )
    .join('\n\n');

  return `Ethan v${version} | ${generatedAt}

Workflow automation assistant. Match trigger keywords to execute the corresponding skill.

${skillLines}

Rules: Follow steps in order. Output per skill template. Auto-detect intent from user input.
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
