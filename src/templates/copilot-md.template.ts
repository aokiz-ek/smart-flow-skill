import { SkillDefinition, BuildContext, Platform } from '../skills/types';

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

  return `# Smart Flow Skill - Copilot Instructions (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

You are equipped with the Smart Flow Skill workflow assistant. When users mention any of the trigger keywords below, execute the corresponding skill workflow precisely.

## Available Skills

${skills.map((s) => renderCopilotSkill(s)).join('\n\n')}

## General Rules

- Detect user intent and auto-match the appropriate Skill at the start of each conversation
- Follow each Skill's defined steps without skipping
- Output strictly follows the defined format template for each Skill
- When user explicitly names a Skill, execute directly without confirmation
`;
}

function renderCopilotSkill(skill: SkillDefinition): string {
  const steps = skill.steps
    .map((step, i) => `${i + 1}. **${step.title.replace(/^\d+\.\s*/, '')}**: ${step.content.split('\n')[0]}`)
    .join('\n');

  return `### ${skill.order}. ${skill.name} (${skill.nameEn})

**Triggers**: ${skill.triggers.map((t) => `\`${t}\``).join(', ')}

**Goal**: ${skill.description}

**Steps**:
${steps}

**Output**: ${skill.outputFormat}`;
}

/** Cline：.clinerules */
function renderCline(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const skillsContent = skills.map(renderClineSkill).join('\n\n');

  return `# Smart Flow Skill v${version}
# Generated: ${generatedAt}
# Source: https://github.com/your-org/smart-flow-skill

工作流自动执行助手。当用户输入以下触发词时，按对应 Skill 的步骤执行。

## 触发词总览
${skills.map((s) => `- **${s.name}**: ${s.triggers.slice(0, 4).join(' | ')}`).join('\n')}

---

${skillsContent}

---
规则：严格按步骤执行，不跳步，输出遵循各 Skill 的格式模板。
`;
}

function renderClineSkill(skill: SkillDefinition): string {
  const stepsContent = skill.steps.map((step) => `${step.title}\n${step.content}`).join('\n\n');
  return `## ${skill.name}

触发：${skill.triggers.slice(0, 4).join(' | ')}
说明：${skill.description}

${stepsContent}

输出格式：${skill.outputFormat}`;
}

/** 通义灵码：.lingma/rules/*.md（结构简洁） */
function renderLingma(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;

  return `# 工作流自动执行助手 v${version}

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

  return `# Smart Flow Skill v${version}

工作流自动执行助手 | 生成时间：${generatedAt}

## Skills

${skills
  .map(
    (s) => `### ${s.order}. ${s.name}
触发词：${s.triggers.slice(0, 3).join(' / ')}
说明：${s.description}
步骤：${s.steps.map((step) => step.title).join(' → ')}
输出：${s.outputFormat}`
  )
  .join('\n\n')}

## 规则
- 根据用户输入自动匹配触发词，执行对应 Skill
- 严格按步骤顺序执行，不省略关键步骤
- 输出格式遵循各 Skill 模板定义
`;
}

/** Windsurf：.windsurf/rules/smart-flow.md（类 Copilot 格式） */
function renderWindsurf(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;

  return `# Smart Flow Skill - Windsurf Rules (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

You are equipped with the Smart Flow Skill workflow assistant for Windsurf. When users mention any of the trigger keywords below, execute the corresponding skill workflow precisely.

## Available Skills

${skills.map((s) => renderCopilotSkill(s)).join('\n\n')}

## General Rules

- Detect user intent and auto-match the appropriate Skill at the start of each conversation
- Follow each Skill's defined steps without skipping
- Output strictly follows the defined format template for each Skill
- When user explicitly names a Skill, execute directly without confirmation
`;
}

/** Zed：smart-flow.rules（精简纯文本，无复杂 Markdown 结构） */
function renderZed(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;

  const skillLines = skills
    .map(
      (s) =>
        `${s.order}. ${s.name} [${s.triggers.slice(0, 3).join('/')}]\n   ${s.description}\n   Steps: ${s.steps.map((step) => step.title.replace(/^\d+\.\s*/, '')).join(' > ')}`
    )
    .join('\n\n');

  return `Smart Flow Skill v${version} | ${generatedAt}

Workflow automation assistant. Match trigger keywords to execute the corresponding skill.

${skillLines}

Rules: Follow steps in order. Output per skill template. Auto-detect intent from user input.
`;
}

/** JetBrains AI：.github/ai-instructions.md（类 Copilot） */
function renderJetBrains(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;

  return `# Smart Flow Skill - JetBrains AI Instructions (v${version})

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually.

You are equipped with the Smart Flow Skill workflow assistant for JetBrains AI. When users mention any of the trigger keywords below, execute the corresponding skill workflow precisely.

## Available Skills

${skills.map((s) => renderCopilotSkill(s)).join('\n\n')}

## General Rules

- Detect user intent and auto-match the appropriate Skill at the start of each conversation
- Follow each Skill's defined steps without skipping
- Output strictly follows the defined format template for each Skill
- When user explicitly names a Skill, execute directly without confirmation
`;
}

/** Continue：.continuerules（类 Cline 格式） */
function renderContinue(ctx: BuildContext): string {
  const { skills, version, generatedAt } = ctx;
  const skillsContent = skills.map(renderClineSkill).join('\n\n');

  return `# Smart Flow Skill v${version}
# Generated: ${generatedAt}
# Source: https://github.com/your-org/smart-flow-skill

工作流自动执行助手（Continue）。当用户输入以下触发词时，按对应 Skill 的步骤执行。

## 触发词总览
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

  const skillsContent = skills
    .map((s) => {
      const stepsContent = s.steps
        .map((step) => `#### ${step.title}\n\n${step.content}`)
        .join('\n\n');

      const triggersLine = s.triggers.map((t) => `\`${t}\``).join(', ');
      const notesLine =
        s.notes && s.notes.length > 0
          ? `\n\n**注意事项**:\n${s.notes.map((n) => `- ${n}`).join('\n')}`
          : '';

      return `### ${s.order}. ${s.name} (\`${s.id}\`)

**描述**: ${s.description}

**触发词**: ${triggersLine}

**执行步骤**:

${stepsContent}

**输出格式**: ${s.outputFormat}${notesLine}`;
    })
    .join('\n\n---\n\n');

  return `# Smart Flow Skill v${version}

> Auto-generated from src/skills/ | ${generatedAt}
> Do not edit manually. Source: src/skills/

## 工作流自动执行助手

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

*Smart Flow Skill - 工作流自动执行助手 | 让每一步都有据可依*
`;
}
