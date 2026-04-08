/**
 * Multi-Agent 编排器
 * 将 Pipeline 的步骤分配给不同 Agent，生成协作式超级 Prompt
 * 执行模型：Prompt 生成（粘贴到 AI 编辑器执行，零 API 成本）
 */

import type { PipelineDefinition, SkillDefinition } from '../skills/types';
import type { AgentDefinition, AgentOrchestrationOptions } from './types';
import { buildSkillRouting, getAgentsForPipeline } from './presets';

/** 根据 skillId 解析对应的 Agent（兜底 Code Agent） */
function resolveAgent(
  skillId: string,
  agents: AgentDefinition[],
  routing: Record<string, string>
): AgentDefinition {
  const agentId = routing[skillId];
  return agents.find((a) => a.id === agentId) ?? agents.find((a) => a.id === 'coder') ?? agents[0];
}

/** 生成 Multi-Agent 编排超级 Prompt */
export function buildMultiAgentPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  options: AgentOrchestrationOptions
): string {
  const { context, lang = 'zh', snapshot } = options;
  const isEn = lang === 'en';
  const routing = buildSkillRouting(agents);
  const participatingAgents = getAgentsForPipeline(pipeline.skillIds, agents, routing);
  const total = skills.length;

  if (isEn) {
    return buildEnPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total);
  }
  return buildZhPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total);
}

// ─── 中文版 ──────────────────────────────────────────────────────────────────

function buildZhPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const header = `# 🤖 Multi-Agent 编排：${pipeline.name}

**任务背景**：${context}
**Pipeline**：${pipeline.name}（\`${pipeline.id}\`）
**执行模式**：Multi-Agent 协作编排
**参与 Agents**：${participatingAgents.length} 个  |  **总步数**：${total} 步`;

  // Agent 阵容表
  const agentStepMap = buildAgentStepMap(skills, agents, routing, false);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    const stepStr = steps.length > 0 ? `步骤 ${steps.join('、')}` : '—';
    return `| ${a.emoji} **${a.name}** | ${a.role} | ${stepStr} |`;
  }).join('\n');

  const roster = `## 🎭 Agent 阵容

| Agent | 职责 | 负责步骤 |
|-------|------|---------|
${rosterRows}`;

  const protocol = `## 📋 协作协议（必须严格遵守）

1. 每个 Agent 严格按分配步骤顺序执行，**不越权执行其他 Agent 的步骤**
2. 每步完成后输出 **Handoff 摘要**（≤150字），交接给下一个 Agent
3. 下一个 Agent 必须**先阅读 Handoff 摘要**，再开始执行
4. 所有步骤完成后，将输出折叠在 \`<details>\` 标签中
5. 全部步骤完成后，输出一份完整的 Multi-Agent 执行报告

**每步输出格式：**

\`\`\`
<details>
<summary>✅ 步骤 N：[Agent名] · [Skill名] — 已完成</summary>

[本步骤完整输出]

</details>
\`\`\``;

  // 步骤详情（含 Agent 标签和 Handoff）
  const stepsSection = skills.map((skill, i) => {
    const stepNum = i + 1;
    const agent = resolveAgent(skill.id, agents, routing);
    const nextAgent = i < skills.length - 1 ? resolveAgent(skills[i + 1].id, agents, routing) : null;

    const handoffFrom = i > 0 ? resolveAgent(skills[i - 1].id, agents, routing) : null;
    const handoffNote = handoffFrom && handoffFrom.id !== agent.id
      ? `> 📨 **Handoff 摘要**（来自 ${handoffFrom.emoji} ${handoffFrom.name}）：\`[上一步核心产出，由上一 Agent 填写]\`\n\n`
      : i > 0
      ? `> 📝 **前序输出**（${agent.emoji} ${agent.name} 连续执行）：使用步骤 ${i} 的核心产出作为背景。\n\n`
      : '';

    const stepsContent = skill.steps
      .map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      })
      .join('\n\n');

    const handoffTo = nextAgent && nextAgent.id !== agent.id
      ? `\n\n#### ✅ Handoff → ${nextAgent.emoji} ${nextAgent.name}\n\n> 🔖 请在此输出本步核心产出（≤150字），交接给 **${nextAgent.name}**：\n> \`[请填写：完成了什么、关键决策、下一步需要注意什么]\``
      : '';

    return `### ${agent.emoji} ${agent.name} — 步骤 ${stepNum}/${total}：${skill.name}

${handoffNote}**目标**：${skill.description}

**执行内容**：

${stepsContent}

**输出格式**：${skill.outputFormat}${handoffTo}`;
  }).join('\n\n---\n\n');

  // 最终报告模板
  const reportTemplate = buildZhReportTemplate(pipeline, skills, agents, participatingAgents, routing, context);
  const startCmd = `**立即开始执行：${participatingAgents[0].emoji} ${participatingAgents[0].name} 执行步骤 1。**`;
  const snapshotBlock = snapshot ?? '';

  return [header, snapshotBlock, '---', roster, '---', protocol, '---', `## 🔄 执行流程`, stepsSection, '---', reportTemplate, startCmd]
    .filter(Boolean)
    .join('\n\n');
}

function buildZhReportTemplate(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string
): string {
  // 按 Agent 分组步骤
  const agentSections = participatingAgents.map((agent) => {
    const agentSkills = skills.filter((s) => {
      const a = resolveAgent(s.id, agents, routing);
      return a.id === agent.id;
    });
    const skillList = agentSkills.map((s) => `### ${s.name}\n[完整输出]\n\n---`).join('\n\n');
    return `## ${agent.emoji} ${agent.name} 产出\n\n${skillList}`;
  }).join('\n\n');

  return `## 📄 最终输出要求

全部步骤完成后，输出以下 Multi-Agent 执行报告：

# Multi-Agent 执行报告 — ${context}
> Pipeline：${pipeline.name} | Agents：${participatingAgents.map((a) => `${a.emoji} ${a.name}`).join(' → ')}

${agentSections}

*由 Ethan Multi-Agent 自动生成*`;
}

// ─── 英文版 ──────────────────────────────────────────────────────────────────

function buildEnPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const header = `# 🤖 Multi-Agent Orchestration: ${pipeline.name}

**Context**: ${context}
**Pipeline**: ${pipeline.name} (\`${pipeline.id}\`)
**Mode**: Multi-Agent Collaboration
**Agents**: ${participatingAgents.length}  |  **Steps**: ${total}`;

  const agentStepMap = buildAgentStepMap(skills, agents, routing, false);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    const stepStr = steps.length > 0 ? `Steps ${steps.join(', ')}` : '—';
    return `| ${a.emoji} **${a.nameEn}** | ${a.role} | ${stepStr} |`;
  }).join('\n');

  const roster = `## 🎭 Agent Roster

| Agent | Role | Assigned Steps |
|-------|------|----------------|
${rosterRows}`;

  const protocol = `## 📋 Collaboration Protocol (Must Follow)

1. Each Agent executes only its assigned steps — **no overstepping**
2. After each step, output a **Handoff Summary** (≤150 words) for the next Agent
3. The next Agent must **read the Handoff Summary** before starting
4. Wrap each step output in \`<details>\` collapse tags
5. After all steps complete, output a merged Multi-Agent Execution Report

**Per-step output format:**

\`\`\`
<details>
<summary>✅ Step N: [Agent Name] · [Skill Name] — Completed</summary>

[Full step output]

</details>
\`\`\``;

  const stepsSection = skills.map((skill, i) => {
    const stepNum = i + 1;
    const agent = resolveAgent(skill.id, agents, routing);
    const nextAgent = i < skills.length - 1 ? resolveAgent(skills[i + 1].id, agents, routing) : null;
    const handoffFrom = i > 0 ? resolveAgent(skills[i - 1].id, agents, routing) : null;

    const handoffNote = handoffFrom && handoffFrom.id !== agent.id
      ? `> 📨 **Handoff Summary** (from ${handoffFrom.emoji} ${handoffFrom.nameEn}): \`[Previous step's key output — filled by prior Agent]\`\n\n`
      : i > 0
      ? `> 📝 **Prior Output** (${agent.emoji} ${agent.nameEn} continues): Use Step ${i} core output as background.\n\n`
      : '';

    const stepsContent = skill.steps
      .map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      })
      .join('\n\n');

    const handoffTo = nextAgent && nextAgent.id !== agent.id
      ? `\n\n#### ✅ Handoff → ${nextAgent.emoji} ${nextAgent.nameEn}\n\n> 🔖 Output core outcome (≤150 words) for **${nextAgent.nameEn}**:\n> \`[Fill in: what was completed, key decisions, notes for next Agent]\``
      : '';

    return `### ${agent.emoji} ${agent.nameEn} — Step ${stepNum}/${total}: ${skill.nameEn.replace(/_/g, ' ')}

${handoffNote}**Goal**: ${skill.descriptionEn ?? skill.description}

**Execution**:

${stepsContent}

**Output Format**: ${skill.outputFormat}${handoffTo}`;
  }).join('\n\n---\n\n');

  const reportTemplate = buildEnReportTemplate(pipeline, skills, agents, participatingAgents, routing, context);
  const startCmd = `**Begin: ${participatingAgents[0].emoji} ${participatingAgents[0].nameEn} executes Step 1 now.**`;
  const snapshotBlock = snapshot ?? '';

  return [header, snapshotBlock, '---', roster, '---', protocol, '---', `## 🔄 Execution Flow`, stepsSection, '---', reportTemplate, startCmd]
    .filter(Boolean)
    .join('\n\n');
}

function buildEnReportTemplate(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string
): string {
  const agentSections = participatingAgents.map((agent) => {
    const agentSkills = skills.filter((s) => {
      const a = resolveAgent(s.id, agents, routing);
      return a.id === agent.id;
    });
    const skillList = agentSkills.map((s) => `### ${s.nameEn.replace(/_/g, ' ')}\n[Full output]\n\n---`).join('\n\n');
    return `## ${agent.emoji} ${agent.nameEn} Output\n\n${skillList}`;
  }).join('\n\n');

  return `## 📄 Final Output Requirements

After all steps complete, output this Multi-Agent Execution Report:

# Multi-Agent Execution Report — ${context}
> Pipeline: ${pipeline.name} | Agents: ${participatingAgents.map((a) => `${a.emoji} ${a.nameEn}`).join(' → ')}

${agentSections}

*Auto-generated by Ethan Multi-Agent*`;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

/**
 * 构建 agentId → 步骤序号列表 的映射，用于 Agent 阵容表展示
 */
function buildAgentStepMap(
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  routing: Record<string, string>,
  _isEn: boolean
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  skills.forEach((skill, i) => {
    const agent = resolveAgent(skill.id, agents, routing);
    if (!map[agent.id]) map[agent.id] = [];
    map[agent.id].push(i + 1);
  });
  return map;
}
