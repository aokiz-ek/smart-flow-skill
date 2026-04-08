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
  const { context, lang = 'zh', snapshot, mode = 'sequential' } = options;
  const isEn = lang === 'en';
  const routing = buildSkillRouting(agents);
  const participatingAgents = getAgentsForPipeline(pipeline.skillIds, agents, routing);
  const total = skills.length;

  if (mode === 'parallel') {
    return isEn
      ? buildEnParallelPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total)
      : buildZhParallelPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total);
  }
  if (mode === 'review-loop') {
    return isEn
      ? buildEnReviewLoopPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total)
      : buildZhReviewLoopPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total);
  }
  if (mode === 'consensus') {
    return isEn
      ? buildEnConsensusPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total)
      : buildZhConsensusPrompt(pipeline, skills, agents, participatingAgents, routing, context, snapshot, total);
  }
  // sequential（默认）
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

// ─── Parallel 模式 ────────────────────────────────────────────────────────────

function buildZhParallelPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const agentStepMap = buildAgentStepMap(skills, agents, routing, false);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    return `| ${a.emoji} **${a.name}** | ${a.role} | 步骤 ${steps.join('、')} |`;
  }).join('\n');

  const header = `# 🤖 Multi-Agent 并行分析：${pipeline.name}

**任务背景**：${context}
**Pipeline**：${pipeline.name}（\`${pipeline.id}\`）
**执行模式**：🔀 Parallel — 各 Agent 并行输出，最后汇总整合
**参与 Agents**：${participatingAgents.length} 个  |  **总步数**：${total} 步

## 🎭 Agent 阵容

| Agent | 职责 | 负责步骤 |
|-------|------|---------|
${rosterRows}`;

  const protocol = `## 📋 并行协议（必须严格遵守）

1. 本次采用 **并行模式**：所有 Agent 基于同一任务背景，**同时**从各自专业视角输出分析
2. 每个 Agent 输出完成后，进入"🏛️ 汇总整合"阶段
3. 汇总整合阶段负责合并所有 Agent 产出，提炼出统一结论与行动项
4. 用 \`<details>\` 折叠各 Agent 的详细输出，最终报告呈现汇总结论

**输出格式：**
\`\`\`
<details>
<summary>✅ [Agent名] 分析完成</summary>
[Agent 完整输出]
</details>
\`\`\``;

  const taskDesc = `## 📢 任务发布（全体 Agent 同时接收）

> **任务**：${context}
> **需要从以下维度并行分析并给出产出：**`;

  const agentBlocks = participatingAgents.map((agent) => {
    const agentSkills = skills.filter((s) => resolveAgent(s.id, agents, routing).id === agent.id);
    const skillNames = agentSkills.map((s) => s.name).join('、');
    const stepsContent = agentSkills.map((skill) => {
      const stepsList = skill.steps.map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      }).join('\n\n');
      return `#### ${skill.name}\n${stepsList}\n**输出格式**：${skill.outputFormat}`;
    }).join('\n\n---\n\n');

    return `### ${agent.emoji} ${agent.name} — 并行分析（${skillNames}）

> 从 **${agent.role}** 视角，对任务进行全面分析：

${stepsContent}`;
  }).join('\n\n---\n\n');

  const synthesis = `## 🏛️ 汇总整合阶段

> 所有 Agent 输出完成后，进行以下整合：

1. **共识点**：各 Agent 分析中的一致结论
2. **分歧与补充**：各 Agent 的独特见解与专项建议
3. **行动项**（优先级排序）：
   - 🔴 立即行动
   - 🟡 近期计划
   - 🟢 长期优化
4. **最终建议**：综合各角度的最优方案

---

# 并行分析报告 — ${context}
> Pipeline：${pipeline.name} | 模式：Parallel | Agents：${participatingAgents.map((a) => `${a.emoji} ${a.name}`).join(' + ')}

## 汇总结论
[由上述各 Agent 分析综合得出]

*由 Ethan Multi-Agent Parallel 自动生成*`;

  return [header, snapshot ?? '', '---', protocol, '---', taskDesc, agentBlocks, '---', synthesis]
    .filter(Boolean)
    .join('\n\n');
}

function buildEnParallelPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const agentStepMap = buildAgentStepMap(skills, agents, routing, true);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    return `| ${a.emoji} **${a.nameEn}** | ${a.role} | Steps ${steps.join(', ')} |`;
  }).join('\n');

  const header = `# 🤖 Multi-Agent Parallel Analysis: ${pipeline.name}

**Context**: ${context}
**Pipeline**: ${pipeline.name} (\`${pipeline.id}\`)
**Mode**: 🔀 Parallel — All agents analyze simultaneously, then synthesize
**Agents**: ${participatingAgents.length}  |  **Steps**: ${total}

## 🎭 Agent Roster

| Agent | Role | Assigned Steps |
|-------|------|----------------|
${rosterRows}`;

  const agentBlocks = participatingAgents.map((agent) => {
    const agentSkills = skills.filter((s) => resolveAgent(s.id, agents, routing).id === agent.id);
    const skillNames = agentSkills.map((s) => s.nameEn.replace(/_/g, ' ')).join(', ');
    const stepsContent = agentSkills.map((skill) => {
      const stepsList = skill.steps.map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      }).join('\n\n');
      return `#### ${skill.nameEn.replace(/_/g, ' ')}\n${stepsList}\n**Output Format**: ${skill.outputFormat}`;
    }).join('\n\n---\n\n');

    return `### ${agent.emoji} ${agent.nameEn} — Parallel Analysis (${skillNames})

${stepsContent}`;
  }).join('\n\n---\n\n');

  const synthesis = `## 🏛️ Synthesis Phase

1. **Consensus**: Agreed conclusions from all agents
2. **Divergence & Additions**: Unique insights per agent
3. **Action Items** (prioritized):
   - 🔴 Immediate
   - 🟡 Near-term
   - 🟢 Long-term
4. **Final Recommendation**: Optimal approach from all angles

---

# Parallel Analysis Report — ${context}
> Pipeline: ${pipeline.name} | Mode: Parallel | Agents: ${participatingAgents.map((a) => `${a.emoji} ${a.nameEn}`).join(' + ')}

*Auto-generated by Ethan Multi-Agent Parallel*`;

  return [header, snapshot ?? '', '---', `## 📢 Task Broadcast\n\n> **Task**: ${context}\n> All agents analyze in parallel from their domain.`, agentBlocks, '---', synthesis]
    .filter(Boolean)
    .join('\n\n');
}

// ─── Review-Loop 模式 ─────────────────────────────────────────────────────────

function buildZhReviewLoopPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const coderAgent = agents.find((a) => a.id === 'coder') ?? participatingAgents[0];
  const reviewerAgent = agents.find((a) => a.id === 'reviewer') ?? agents.find((a) => a.id === 'qa') ?? participatingAgents[participatingAgents.length - 1];

  const header = `# 🤖 Multi-Agent Review-Loop：${pipeline.name}

**任务背景**：${context}
**Pipeline**：${pipeline.name}（\`${pipeline.id}\`）
**执行模式**：🔄 Review-Loop — 实现 → 审查 → 修改（最多 2 轮迭代）
**核心 Agents**：${coderAgent.emoji} ${coderAgent.name}（执行）+ ${reviewerAgent.emoji} ${reviewerAgent.name}（审查）
**总步数**：${total} 步`;

  const protocol = `## 📋 Review-Loop 协议（必须严格遵守）

1. **Loop 1 — 实现阶段**：${coderAgent.emoji} ${coderAgent.name} 按步骤执行全部任务
2. **Loop 1 — 审查阶段**：${reviewerAgent.emoji} ${reviewerAgent.name} 对实现结果进行全面审查
   - 若审查通过（无 Blocker）→ 直接输出最终报告
   - 若有 Blocker/Major 问题 → 进入 Loop 2
3. **Loop 2 — 修改阶段**：${coderAgent.emoji} ${coderAgent.name} 仅修复审查指出的问题
4. **Loop 2 — 确认阶段**：${reviewerAgent.emoji} ${reviewerAgent.name} 确认修复，输出最终报告
5. **最多 2 轮迭代**，第 2 轮结束后无论如何输出最终报告`;

  const stepsContent = skills.map((skill, i) => {
    const stepNum = i + 1;
    const stepsList = skill.steps.map((s, si) => {
      const title = s.title.replace(/^\d+[.、]\s*/, '');
      const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
      return `   ${si + 1}. **${title}**\n${indented}`;
    }).join('\n\n');
    return `#### 步骤 ${stepNum}：${skill.name}\n${stepsList}\n**输出格式**：${skill.outputFormat}`;
  }).join('\n\n---\n\n');

  const loop1 = `## 🔄 Loop 1 — 实现阶段

${coderAgent.emoji} **${coderAgent.name}** 按顺序执行以下所有步骤：

${stepsContent}

---

## 🔄 Loop 1 — 审查阶段

${reviewerAgent.emoji} **${reviewerAgent.name}** 对上述全部实现进行审查：

1. 检查每个步骤的输出是否满足任务目标
2. 识别 🚫 Blocker / ⚠️ Major / 💡 Minor 问题
3. 评估整体质量与完整性

**审查结论：**
- [ ] ✅ 通过（无 Blocker/Major）→ 跳过 Loop 2，直接输出最终报告
- [ ] ⚠️ 需要修改（有 Blocker/Major）→ 进入 Loop 2

**问题清单（如有）：**
| 问题级别 | 步骤 | 问题描述 | 修改建议 |
|---------|------|---------|---------|
| [级别] | [步骤N] | [描述] | [建议] |`;

  const loop2 = `## 🔄 Loop 2 — 修改阶段（仅在 Loop 1 审查不通过时执行）

${coderAgent.emoji} **${coderAgent.name}** 根据审查意见，**仅修复 Blocker 和 Major 问题**：

> 📨 **审查意见摘要**（来自 ${reviewerAgent.emoji} ${reviewerAgent.name}）：\`[Loop 1 审查问题列表]\`

针对每个 Blocker/Major 问题输出修改内容。

---

## 🔄 Loop 2 — 确认阶段

${reviewerAgent.emoji} **${reviewerAgent.name}** 确认修复是否满足要求：

- [ ] ✅ 修复通过 → 输出最终报告
- [ ] ❌ 仍有问题 → 记录遗留问题，强制输出最终报告（已达迭代上限）`;

  const finalReport = `## 📄 最终输出

# Review-Loop 执行报告 — ${context}
> Pipeline：${pipeline.name} | 模式：Review-Loop | Agents：${coderAgent.emoji} ${coderAgent.name} ⇄ ${reviewerAgent.emoji} ${reviewerAgent.name}

## 最终实现产出
[Loop 1 或 Loop 2 修改后的完整输出]

## 审查摘要
- 发现问题：[Blocker X 个 | Major Y 个 | Minor Z 个]
- 已修复：[描述]
- 遗留（如有）：[描述]

*由 Ethan Multi-Agent Review-Loop 自动生成*`;

  return [header, snapshot ?? '', '---', protocol, '---', loop1, '---', loop2, '---', finalReport]
    .filter(Boolean)
    .join('\n\n');
}

function buildEnReviewLoopPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const coderAgent = agents.find((a) => a.id === 'coder') ?? participatingAgents[0];
  const reviewerAgent = agents.find((a) => a.id === 'reviewer') ?? agents.find((a) => a.id === 'qa') ?? participatingAgents[participatingAgents.length - 1];

  const header = `# 🤖 Multi-Agent Review-Loop: ${pipeline.name}

**Context**: ${context}
**Pipeline**: ${pipeline.name} (\`${pipeline.id}\`)
**Mode**: 🔄 Review-Loop — Implement → Review → Fix (max 2 iterations)
**Core Agents**: ${coderAgent.emoji} ${coderAgent.nameEn} (execute) + ${reviewerAgent.emoji} ${reviewerAgent.nameEn} (review)
**Steps**: ${total}`;

  const stepsContent = skills.map((skill, i) => {
    const stepNum = i + 1;
    const stepsList = skill.steps.map((s, si) => {
      const title = s.title.replace(/^\d+[.、]\s*/, '');
      const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
      return `   ${si + 1}. **${title}**\n${indented}`;
    }).join('\n\n');
    return `#### Step ${stepNum}: ${skill.nameEn.replace(/_/g, ' ')}\n${stepsList}\n**Output Format**: ${skill.outputFormat}`;
  }).join('\n\n---\n\n');

  const loop1 = `## 🔄 Loop 1 — Implementation

${coderAgent.emoji} **${coderAgent.nameEn}** executes all steps in order:

${stepsContent}

---

## 🔄 Loop 1 — Review

${reviewerAgent.emoji} **${reviewerAgent.nameEn}** reviews all outputs:

- [ ] ✅ Pass (no Blockers/Major) → Skip Loop 2, output final report
- [ ] ⚠️ Issues found → Enter Loop 2`;

  const loop2 = `## 🔄 Loop 2 — Fix (only if Loop 1 review failed)

${coderAgent.emoji} **${coderAgent.nameEn}** fixes Blocker and Major issues only.

---

## 🔄 Loop 2 — Confirm

${reviewerAgent.emoji} **${reviewerAgent.nameEn}** confirms fixes, then outputs final report.`;

  const finalReport = `## 📄 Final Output

# Review-Loop Report — ${context}
> Pipeline: ${pipeline.name} | Mode: Review-Loop | Agents: ${coderAgent.emoji} ${coderAgent.nameEn} ⇄ ${reviewerAgent.emoji} ${reviewerAgent.nameEn}

*Auto-generated by Ethan Multi-Agent Review-Loop*`;

  return [header, snapshot ?? '', '---', loop1, '---', loop2, '---', finalReport]
    .filter(Boolean)
    .join('\n\n');
}

// ─── Consensus 模式 ───────────────────────────────────────────────────────────

function buildZhConsensusPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const agentStepMap = buildAgentStepMap(skills, agents, routing, false);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    return `| ${a.emoji} **${a.name}** | ${a.role} | 步骤 ${steps.join('、')} |`;
  }).join('\n');

  const header = `# 🤖 Multi-Agent 共识决策：${pipeline.name}

**任务背景**：${context}
**Pipeline**：${pipeline.name}（\`${pipeline.id}\`）
**执行模式**：🏛️ Consensus — 各 Agent 独立提案，共识整合最优解
**参与 Agents**：${participatingAgents.length} 个  |  **总步数**：${total} 步

## 🎭 Agent 阵容

| Agent | 职责 | 负责步骤 |
|-------|------|---------|
${rosterRows}`;

  const protocol = `## 📋 共识协议（必须严格遵守）

1. **提案阶段**：每个 Agent 从自己的视角，**独立**地为任务给出完整方案
2. Agent 之间**互不干扰**，不参考其他 Agent 的方案
3. **共识阶段**：比较所有提案，提炼共识、识别分歧
4. **最终推荐**：基于共识，输出最优综合方案与明确行动计划`;

  const proposalBlocks = participatingAgents.map((agent, idx) => {
    const agentSkills = skills.filter((s) => resolveAgent(s.id, agents, routing).id === agent.id);
    const stepsContent = agentSkills.map((skill) => {
      const stepsList = skill.steps.map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      }).join('\n\n');
      return `#### ${skill.name}\n${stepsList}\n**输出格式**：${skill.outputFormat}`;
    }).join('\n\n---\n\n');

    return `### 提案 ${idx + 1}：${agent.emoji} ${agent.name}

> 以下是 **${agent.name}** 基于 **${agent.role}** 视角的独立方案：

${stepsContent}`;
  }).join('\n\n---\n\n');

  const consensus = `## 🏛️ 共识整合阶段

> 所有提案提交完毕，现在进行共识分析：

### 1. 共识点（各方认同的结论）
[列出各 Agent 方案中一致的内容]

### 2. 分歧点（不同视角的差异）
| 维度 | ${participatingAgents.map((a) => a.name).join(' | ')} | 分析 |
|------|${participatingAgents.map(() => '---').join('|')}|------|
| [方面] | [各 Agent 观点] | [如何取舍] |

### 3. 最终推荐方案
基于共识整合，推荐以下最优方案：

[综合各 Agent 优势的最终方案]

### 4. 行动计划
| 优先级 | 行动项 | 负责方 |
|--------|--------|--------|
| 🔴 P0 | [立即执行] | [Agent] |
| 🟡 P1 | [近期计划] | [Agent] |

---

# 共识决策报告 — ${context}
> Pipeline：${pipeline.name} | 模式：Consensus | Agents：${participatingAgents.map((a) => `${a.emoji} ${a.name}`).join(' + ')}

*由 Ethan Multi-Agent Consensus 自动生成*`;

  return [header, snapshot ?? '', '---', protocol, '---', `## 📝 提案阶段（各 Agent 独立输出）`, proposalBlocks, '---', consensus]
    .filter(Boolean)
    .join('\n\n');
}

function buildEnConsensusPrompt(
  pipeline: PipelineDefinition,
  skills: SkillDefinition[],
  agents: AgentDefinition[],
  participatingAgents: AgentDefinition[],
  routing: Record<string, string>,
  context: string,
  snapshot: string | undefined,
  total: number
): string {
  const agentStepMap = buildAgentStepMap(skills, agents, routing, true);
  const rosterRows = participatingAgents.map((a) => {
    const steps = agentStepMap[a.id] || [];
    return `| ${a.emoji} **${a.nameEn}** | ${a.role} | Steps ${steps.join(', ')} |`;
  }).join('\n');

  const header = `# 🤖 Multi-Agent Consensus: ${pipeline.name}

**Context**: ${context}
**Pipeline**: ${pipeline.name} (\`${pipeline.id}\`)
**Mode**: 🏛️ Consensus — Each agent proposes independently, then synthesize
**Agents**: ${participatingAgents.length}  |  **Steps**: ${total}

## 🎭 Agent Roster

| Agent | Role | Assigned Steps |
|-------|------|----------------|
${rosterRows}`;

  const proposalBlocks = participatingAgents.map((agent, idx) => {
    const agentSkills = skills.filter((s) => resolveAgent(s.id, agents, routing).id === agent.id);
    const stepsContent = agentSkills.map((skill) => {
      const stepsList = skill.steps.map((s, si) => {
        const title = s.title.replace(/^\d+[.、]\s*/, '');
        const indented = s.content.split('\n').map((l) => `   ${l}`).join('\n');
        return `   ${si + 1}. **${title}**\n${indented}`;
      }).join('\n\n');
      return `#### ${skill.nameEn.replace(/_/g, ' ')}\n${stepsList}\n**Output Format**: ${skill.outputFormat}`;
    }).join('\n\n---\n\n');

    return `### Proposal ${idx + 1}: ${agent.emoji} ${agent.nameEn}

> Independent proposal from **${agent.nameEn}** (${agent.role}):

${stepsContent}`;
  }).join('\n\n---\n\n');

  const consensus = `## 🏛️ Consensus Phase

### 1. Agreed Points
[Common conclusions across all proposals]

### 2. Divergences
| Dimension | ${participatingAgents.map((a) => a.nameEn).join(' | ')} | Resolution |
|-----------|${participatingAgents.map(() => '---').join('|')}|------------|

### 3. Final Recommendation
[Synthesized optimal approach]

### 4. Action Plan
| Priority | Action | Owner |
|----------|--------|-------|
| 🔴 P0 | [Immediate] | [Agent] |

---

# Consensus Report — ${context}
> Pipeline: ${pipeline.name} | Mode: Consensus | Agents: ${participatingAgents.map((a) => `${a.emoji} ${a.nameEn}`).join(' + ')}

*Auto-generated by Ethan Multi-Agent Consensus*`;

  return [header, snapshot ?? '', '---', `## 📝 Proposal Phase (Each Agent Independent)`, proposalBlocks, '---', consensus]
    .filter(Boolean)
    .join('\n\n');
}
