/**
 * MCP Server（stdio transport）
 * 每个 Skill → 一个 MCP tool
 * 运行：node dist/mcp/server.js  或  npx ethan mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ALL_SKILLS } from '../skills/index';
import type { SkillDefinition } from '../skills/types';
import { PIPELINES, resolvePipeline } from '../skills/pipeline';
import {
  loadSession,
  markStepDone,
  buildStepPrompt,
  getCurrentStep,
  getCurrentStepIndex,
  calcProgress,
} from '../workflow/state';
import { getStagedDiff, getBranchDiff, truncateDiff, isGitRepo } from '../git/utils';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MemoryEntry {
  id: string;
  type: 'workflow' | 'skill' | 'custom';
  skillId?: string;
  pipelineId?: string;
  title: string;
  content: string;
  tags: string[];
  project?: string;
  createdAt: string;
}

function searchMemoryEntries(query: string, cwd: string): MemoryEntry[] {
  const dirs = [
    path.join(cwd, '.ethan', 'memory'),
    path.join(os.homedir(), '.ethan-memory'),
  ];
  const results: MemoryEntry[] = [];
  const q = query.toLowerCase();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const entry = JSON.parse(
            fs.readFileSync(path.join(dir, file), 'utf-8')
          ) as MemoryEntry;
          if (
            entry.title.toLowerCase().includes(q) ||
            entry.content.toLowerCase().includes(q) ||
            (entry.tags || []).some((t) => t.toLowerCase().includes(q))
          ) {
            results.push(entry);
          }
        } catch { /* skip invalid */ }
      }
    } catch { /* skip unreadable dir */ }
  }
  return results.slice(0, 10);
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

/**
 * 将 SkillDefinition 转换为 MCP Tool 定义
 */
function skillToMcpTool(skill: SkillDefinition): Tool {
  return {
    name: skill.nameEn,
    description: `[${skill.name}] ${skill.description}`,
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: `用户需求或上下文描述，将作为执行 "${skill.name}" Skill 的输入`,
        },
        format: {
          type: 'string',
          enum: ['full', 'brief'],
          description: 'full=完整执行所有步骤（默认），brief=只返回关键输出',
          default: 'full',
        },
      },
      required: ['context'],
    },
  };
}

/**
 * 生成 Skill 执行结果（Markdown 格式）
 */
function executeSkill(skill: SkillDefinition, context: string, format: 'full' | 'brief'): string {
  if (format === 'brief') {
    return `## ${skill.name}\n\n${skill.description}\n\n**输入**：${context}\n\n*请根据以上输入，直接输出 ${skill.outputFormat}*`;
  }

  const stepsContent = skill.steps
    .map((step) => `### ${step.title}\n\n${step.content}`)
    .join('\n\n');

  let result = `# 执行 Skill：${skill.name}\n\n`;
  result += `**输入上下文**：${context}\n\n`;
  result += `---\n\n`;
  result += `## 执行流程\n\n${stepsContent}\n\n`;
  result += `---\n\n`;
  result += `## 输出格式\n\n${skill.outputFormat}\n\n`;

  if (skill.notes && skill.notes.length > 0) {
    result += `## 注意事项\n\n${skill.notes.map((n) => `- ${n}`).join('\n')}\n\n`;
  }

  return result;
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: 'ethan-skill',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const pipelineTool: Tool = {
    name: 'ethan_pipeline',
    description: '按 Pipeline 顺序串联执行多个 Skill，适用于完整工作流场景',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline: {
          type: 'string',
          enum: PIPELINES.map((p) => p.id),
          description: `要执行的 Pipeline ID。可选值：${PIPELINES.map((p) => `${p.id}（${p.name}）`).join('、')}`,
        },
        context: {
          type: 'string',
          description: '用户需求或上下文描述，将作为 Pipeline 中所有 Skill 的输入基础',
        },
      },
      required: ['pipeline', 'context'],
    },
  };

  const workflowNextTool: Tool = {
    name: 'ethan_workflow_next',
    description: [
      '完成工作流当前步骤并推进到下一步。',
      '当你（AI 编辑器）已完成某步骤的任务时，调用此工具传入本步摘要，',
      '工具会返回下一步的完整执行提示词（包含前序步骤上下文链），',
      '你可以直接将返回的提示词作为下一步的指令执行。',
      '若工作流已全部完成，返回完成状态。',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '本步骤的执行摘要和关键产出，将作为下一步的上下文输入',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认使用 MCP server 启动时的工作目录）',
        },
      },
      required: ['summary'],
    },
  };

  const workflowStatusTool: Tool = {
    name: 'ethan_workflow_status',
    description: '查看当前工作流的进度状态，返回各步骤完成情况和当前步骤的执行提示词。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '项目目录路径（默认使用 MCP server 启动时的工作目录）',
        },
      },
      required: [],
    },
  };

  const memorySearchTool: Tool = {
    name: 'ethan_memory_search',
    description: '在 Skill 记忆库中搜索历史工作流归档、自定义条目。支持按标题、内容、标签模糊搜索，返回最多 10 条匹配结果。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词（匹配标题、内容或标签）',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认使用 MCP server 启动时的工作目录）',
        },
      },
      required: ['query'],
    },
  };

  const estimateTool: Tool = {
    name: 'ethan_estimate',
    description: '根据任务描述生成研发工时估算提示词，输出乐观/正常/悲观三点估算及 T-shirt Size，辅助 Sprint 规划。',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '任务或功能描述，越详细估算越准确',
        },
        style: {
          type: 'string',
          enum: ['hours', 'story-points', 'days'],
          description: '估算单位：hours（小时）/ story-points（故事点）/ days（人天），默认 hours',
          default: 'hours',
        },
        team: {
          type: 'string',
          description: '团队规模（如 "2人"），可选',
        },
      },
      required: ['description'],
    },
  };

  const gitCommitTool: Tool = {
    name: 'ethan_git_commit',
    description: '读取当前 git 仓库的 staged diff，生成符合 Conventional Commits 规范的提交信息（type(scope): subject + body）。需要在 git 项目目录中运行。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '项目目录路径（默认使用 MCP server 启动时的工作目录）',
        },
        hint: {
          type: 'string',
          description: '��外说明（如 commit 的业务背景），可选',
        },
      },
      required: [],
    },
  };

  const gitReviewTool: Tool = {
    name: 'ethan_git_review',
    description: '读取当前分支与主分支的 diff，生成 Blocker / Major / Minor 分级 Code Review 提示词。需要在 git 项目目录中运行。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '项目目录路径（默认使用 MCP server 启动时的工作目录）',
        },
        base: {
          type: 'string',
          description: '对比的基准分支，默认自动检测（main 或 master）',
        },
      },
      required: [],
    },
  };

  const autopilotTool: Tool = {
    name: 'ethan_autopilot',
    description: '生成 Auto-Pilot 超级 Prompt，将完整 Pipeline 的所有步骤打包为单条链式执行指令。粘贴到 AI 编辑器后，AI 将自动链式执行所有步骤，无需手动推进，最终输出完整合并报告。',
    inputSchema: {
      type: 'object',
      properties: {
        pipelineId: {
          type: 'string',
          enum: PIPELINES.map((p) => p.id),
          description: `Pipeline ID。可选值：${PIPELINES.map((p) => `${p.id}（${p.name}）`).join('、')}`,
        },
        context: {
          type: 'string',
          description: '任务背景描述（如"实现用户登录功能，支持 JWT 认证"）',
        },
        lang: {
          type: 'string',
          enum: ['zh', 'en'],
          description: '输出语言：zh（默认）或 en',
          default: 'zh',
        },
        withContext: {
          type: 'boolean',
          description: '是否采集并注入项目上下文快照（技术栈/git 提交/目录树）',
          default: false,
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（withContext=true 时使用，默认为当前目录）',
        },
      },
      required: ['pipelineId', 'context'],
    },
  };

  const agentOrchestrateTool: Tool = {
    name: 'ethan_agent_orchestrate',
    description: '生成 Multi-Agent 编排 Prompt：将 Pipeline 步骤分配给不同角色的 Agent（Architect / Code / Review / DevOps / PM 等），每个 Agent 按职责执行对应步骤，通过 Handoff 摘要协作传递上下文。支持 4 种协作模式：sequential（顺序）/ parallel（并行）/ review-loop（迭代审查）/ consensus（共识决策）。',
    inputSchema: {
      type: 'object',
      properties: {
        pipelineId: {
          type: 'string',
          enum: PIPELINES.map((p) => p.id),
          description: `Pipeline ID。可选值：${PIPELINES.map((p) => `${p.id}（${p.name}）`).join('、')}`,
        },
        context: {
          type: 'string',
          description: '任务背景描述（如"实现用户登录功能，支持 JWT 认证"）',
        },
        mode: {
          type: 'string',
          enum: ['sequential', 'parallel', 'review-loop', 'consensus'],
          description: '协作模式：sequential（顺序，默认）/ parallel（并行分析）/ review-loop（实现→审查→修改）/ consensus（独立提案→共识整合）',
          default: 'sequential',
        },
        lang: {
          type: 'string',
          enum: ['zh', 'en'],
          description: '输出语言：zh（默认）或 en',
          default: 'zh',
        },
        withContext: {
          type: 'boolean',
          description: '是否采集并注入项目上下文快照',
          default: false,
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
      },
      required: ['pipelineId', 'context'],
    },
  };

  const agentListTool: Tool = {
    name: 'ethan_agent_list',
    description: '列出所有可用 Agent（8 个内置：Architect/Coder/Reviewer/DevOps/PM/QA/Security/Data + 用户自定义）及其职责和 Skill 分配。用于了解当前项目可用的 Agent 阵容。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录，用于加载自定义 Agent）',
        },
      },
    },
  };

  const agentShowTool: Tool = {
    name: 'ethan_agent_show',
    description: '查看指定 Agent 的详细配置，包含 id、名称、职责描述和负责的 Skill ID 列表。',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID，如 architect / coder / reviewer / devops / pm / qa / security / data 或自定义 Agent ID',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
      },
      required: ['agentId'],
    },
  };

  const contextSnapshotTool: Tool = {
    name: 'ethan_context_snapshot',
    description: '采集当前项目的上下文快照，包含技术栈、编程语言、框架、近期 git 提交记录、变更文件列表和目录树。可用于为 Auto-Pilot 或工作流步骤提供项目背景信息。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: '输出格式：markdown（默认）或 json',
          default: 'markdown',
        },
        useCache: {
          type: 'boolean',
          description: '是否使用缓存（TTL 30min，默认 true）',
          default: true,
        },
      },
      required: [],
    },
  };

  const specProposalTool: Tool = {
    name: 'ethan_spec_proposal',
    description: '基于 OpenSpec 规范，生成完整变更提案包（proposal.md + design.md + tasks.md + spec delta），在编码前对齐需求意图与实现范围。',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '变更描述（如"新增用户邮箱二次验证功能"）',
        },
        capability: {
          type: 'string',
          description: '涉及的 OpenSpec capability 名称（如"auth"、"user-profile"），多个用逗号分隔',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
      },
      required: ['description'],
    },
  };

  const specReviewTool: Tool = {
    name: 'ethan_spec_review',
    description: '意图级 Spec Review：对比 openspec/changes/ 中的 spec delta 与代码 diff，检查实现是否准确反映需求意图，输出对齐矩阵和分级偏差报告。',
    inputSchema: {
      type: 'object',
      properties: {
        changeId: {
          type: 'string',
          description: 'Change ID（格式 yyyymmdd-xxxx），不填则自动取最新变更',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
      },
      required: [],
    },
  };

  const specValidateTool: Tool = {
    name: 'ethan_spec_validate',
    description: '校验项目 openspec/ 目录的规范完整性：检查 spec.md 结构、Requirements 编号格式、Scenario GIVEN/WHEN/THEN 完整性，输出问题列表。',
    inputSchema: {
      type: 'object',
      properties: {
        capability: {
          type: 'string',
          description: '指定 capability 名称（不填则校验所有 capability）',
        },
        cwd: {
          type: 'string',
          description: '项目目录路径（默认为当前目录）',
        },
      },
      required: [],
    },
  };

  const doraTool: Tool = {
    name: 'ethan_dora',
    description: '统计 git 历史，计算 DORA 四键指标（部署频率/变更前置时间/变更失败率/平均恢复时间），输出等级评估与改进建议。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '项目目录路径（默认当前目录）' },
        since_days: { type: 'number', description: '统计最近 N 天（默认 30）' },
      },
      required: [],
    },
  };

  const prAnalyticsTool: Tool = {
    name: 'ethan_pr_analytics',
    description: '分析 git 合并历史，输出 PR 大小分布、热点文件 Top 10 和工程效能建议。',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: '项目目录路径（默认当前目录）' },
        days: { type: 'number', description: '统计最近 N 天（默认 30）' },
      },
      required: [],
    },
  };

  const postmortemTool: Tool = {
    name: 'ethan_postmortem',
    description: '生成结构化故障复盘（Postmortem）提示词，遵循 Google SRE 格式：事故摘要 → 5 Why 根因 → 时间线 → 后续行动。',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: '事故 ID（如 INC-001，选填）' },
        cwd: { type: 'string', description: '项目目录路径（默认当前目录）' },
      },
      required: [],
    },
  };

  const scaffoldTool: Tool = {
    name: 'ethan_scaffold',
    description: '生成黄金路径脚手架提示词。支持模板：react-ts | node-api | cli-tool | monorepo | library。',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description: '模板名称：react-ts | node-api | cli-tool | monorepo | library',
          enum: ['react-ts', 'node-api', 'cli-tool', 'monorepo', 'library'],
        },
        dir: { type: 'string', description: '目标目录（选填）' },
      },
      required: ['template'],
    },
  };

  const upgradeTool: Tool = {
    name: 'ethan_upgrade',
    description: '检查 ethan-skill 是否有新版本，并查询当前安装版本与 npm 最新版本的对比信息。如需升级，请在终端运行 `ethan upgrade`。',
    inputSchema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: '是否强制提示升级，即使当前已是最新版本（默认 false）',
          default: false,
        },
      },
      required: [],
    },
  };

  const complianceTool: Tool = {
    name: 'ethan_compliance',
    description: '生成合规证据收集提示词，支持 SOC 2 / GDPR / ISO 27001，输出控制措施清单与差距分析。',
    inputSchema: {
      type: 'object',
      properties: {
        standard: {
          type: 'string',
          description: '合规标准：soc2 | gdpr | iso27001',
          enum: ['soc2', 'gdpr', 'iso27001'],
        },
        cwd: { type: 'string', description: '项目目录路径（选填）' },
      },
      required: ['standard'],
    },
  };

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...ALL_SKILLS.map(skillToMcpTool),
        pipelineTool,
        workflowNextTool,
        workflowStatusTool,
        memorySearchTool,
        estimateTool,
        gitCommitTool,
        gitReviewTool,
        autopilotTool,
        agentOrchestrateTool,
        agentListTool,
        agentShowTool,
        contextSnapshotTool,
        specProposalTool,
        specReviewTool,
        specValidateTool,
        doraTool,
        prAnalyticsTool,
        postmortemTool,
        scaffoldTool,
        complianceTool,
        upgradeTool,
      ],
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // ── ethan_workflow_status ──────────────────────────────────────────────
    if (name === 'ethan_workflow_status') {
      const cwd = (args?.cwd as string) || process.cwd();
      const session = loadSession(cwd);

      if (!session) {
        return {
          content: [{
            type: 'text',
            text: '当前目录暂无工作流会话。\n\n运行 `ethan workflow start <pipeline-id> -c "任务描述"` 启动工作流。',
          }],
        };
      }

      const progress = calcProgress(session);
      const currentIdx = getCurrentStepIndex(session);
      const statusIcon: Record<string, string> = {
        'done': '✅', 'in-progress': '▶️', 'pending': '⬜', 'skipped': '⏭️',
      };

      let text = `# 工作流进度\n\n`;
      text += `- **Pipeline**: ${session.pipelineName}\n`;
      text += `- **Session**: ${session.id}\n`;
      text += `- **进度**: ${progress}% (${session.steps.filter((s) => s.status === 'done').length}/${session.steps.length})\n`;
      text += `- **状态**: ${session.completed ? '🎉 已全部完成' : `第 ${currentIdx + 1}/${session.steps.length} 步进行中`}\n`;
      text += `- **任务背景**: ${session.initialContext}\n\n`;

      text += `## 步骤详情\n\n`;
      for (let i = 0; i < session.steps.length; i++) {
        const step = session.steps[i];
        const icon = statusIcon[step.status] ?? '⬜';
        const marker = i === currentIdx ? ' ← **当前**' : '';
        text += `${icon} **${i + 1}. ${step.skillId}**${marker}\n`;
        if (step.summary) {
          text += `   > 摘要：${step.summary}\n`;
        }
        text += '\n';
      }

      if (!session.completed) {
        const currentStep = session.steps[currentIdx];
        const skill = ALL_SKILLS.find((s) => s.id === currentStep.skillId);
        if (skill) {
          text += `---\n\n## 当前步骤提示词\n\n`;
          text += buildStepPrompt(session, currentStep, skill);
          text += `\n\n---\n\n`;
          text += `**完成本步后，调用 \`ethan_workflow_next\` 工具并传入本步摘要即可推进到下一步。**`;
        }
      }

      return { content: [{ type: 'text', text }] };
    }

    // ── ethan_workflow_next ────────────────────────────────────────────────
    if (name === 'ethan_workflow_next') {
      const summary = ((args?.summary as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      if (!summary) {
        return {
          content: [{ type: 'text', text: '❌ 请提供本步骤的执行摘要（summary 参数不能为空）' }],
          isError: true,
        };
      }

      const session = loadSession(cwd);
      if (!session) {
        return {
          content: [{ type: 'text', text: '❌ 未找到工作流会话。请先运行 `ethan workflow start` 启动工作流。' }],
          isError: true,
        };
      }
      if (session.completed) {
        return {
          content: [{ type: 'text', text: `🎉 工作流"${session.pipelineName}"已全部完成！\n\n运行 \`ethan workflow reset\` 开始新工作流。` }],
        };
      }

      const prevStep = getCurrentStep(session);
      const prevIdx = getCurrentStepIndex(session);
      const nextStep = markStepDone(session, summary, cwd);
      const progress = calcProgress(session);

      if (!nextStep) {
        return {
          content: [{
            type: 'text',
            text: [
              `🎉 **工作流全部完成！**`,
              ``,
              `- Pipeline: ${session.pipelineName}`,
              `- 共完成 ${session.steps.length} 个步骤`,
              `- 进度: 100%`,
              ``,
              `运行 \`ethan workflow status\` 查看完整报告，或 \`ethan workflow reset\` 开始新工作流。`,
            ].join('\n'),
          }],
        };
      }

      const nextSkill = ALL_SKILLS.find((s) => s.id === nextStep.skillId);
      if (!nextSkill) {
        return {
          content: [{ type: 'text', text: `❌ 未找到下一步的 Skill：${nextStep.skillId}` }],
          isError: true,
        };
      }

      // 重新加载保存后的 session 以确保包含最新摘要
      const updatedSession = loadSession(cwd)!;
      const prompt = buildStepPrompt(updatedSession, nextStep, nextSkill);

      const text = [
        `✅ **步骤 ${prevIdx + 1}（${prevStep?.skillId}）已完成** → 进度 ${progress}%`,
        ``,
        `---`,
        ``,
        prompt,
        ``,
        `---`,
        ``,
        `**完成本步后，再次调用 \`ethan_workflow_next\` 并传入摘要即可继续推进。**`,
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    }

    if (name === 'ethan_pipeline') {
      const pipelineId = (args?.pipeline as string) || '';
      const context = (args?.context as string) || '';

      if (!pipelineId) {
        const list = PIPELINES.map((p) => `- \`${p.id}\`：${p.name}`).join('\n');
        return {
          content: [{ type: 'text', text: `❌ pipeline 参数不能为空。\n\n**可用 Pipeline：**\n${list}` }],
          isError: true,
        };
      }

      if (!context) {
        return {
          content: [{ type: 'text', text: `❌ context 参数不能为空，请提供任务描述（如"实现用户登录功能"）。` }],
          isError: true,
        };
      }

      const resolved = resolvePipeline(pipelineId);

      if (!resolved) {
        return {
          content: [
            {
              type: 'text',
              text: `Unknown pipeline: ${pipelineId}. Available: ${PIPELINES.map((p) => p.id).join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const { pipeline, skills } = resolved;
      let result = `# Pipeline 执行：${pipeline.name}\n\n`;
      result += `**描述**：${pipeline.description}\n\n`;
      result += `**包含 Skill**：${skills.map((s) => s.name).join(' → ')}\n\n`;
      result += `**输入上下文**：${context}\n\n`;
      result += `${'='.repeat(60)}\n\n`;

      result += skills
        .map((skill) => executeSkill(skill, context, 'full'))
        .join('\n\n---\n\n');

      return {
        content: [{ type: 'text', text: result }],
      };
    }

    // ── ethan_memory_search ────────────────────────────────────────────────
    if (name === 'ethan_memory_search') {
      const query = ((args?.query as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      if (!query) {
        return {
          content: [{ type: 'text', text: '❌ 请提供搜索关键词（query 参数不能为空）' }],
          isError: true,
        };
      }

      const entries = searchMemoryEntries(query, cwd);
      if (entries.length === 0) {
        return {
          content: [{ type: 'text', text: `🔍 未找到与 "${query}" 相关的记忆条目。\n\n使用 \`ethan memory add\` 添加条目，或完成工作流后自动归档。` }],
        };
      }

      let text = `# 记忆库搜索结果："${query}"\n\n共找到 ${entries.length} 条匹配\n\n`;
      entries.forEach((e, i) => {
        text += `## ${i + 1}. ${e.title}\n\n`;
        text += `- **���型**: ${e.type}${e.skillId ? ` · Skill: ${e.skillId}` : ''}${e.pipelineId ? ` · Pipeline: ${e.pipelineId}` : ''}\n`;
        text += `- **标签**: ${e.tags.length ? e.tags.join(', ') : '无'}\n`;
        text += `- **时间**: ${e.createdAt}\n\n`;
        text += `${e.content}\n\n---\n\n`;
      });

      return { content: [{ type: 'text', text }] };
    }

    // ── ethan_estimate ────────────────────────────────────────────────────
    if (name === 'ethan_estimate') {
      const description = ((args?.description as string) || '').trim();
      const style = ((args?.style as string) || 'hours') as 'hours' | 'story-points' | 'days';
      const team = (args?.team as string) || '';

      if (!description) {
        return {
          content: [{ type: 'text', text: '❌ 请提供任务描述（description 参数不能为空）' }],
          isError: true,
        };
      }

      const unitLabel = style === 'hours' ? '小时' : style === 'story-points' ? '故事点' : '人天';
      let prompt = `# 研发工时估算\n\n`;
      prompt += `## 任务描述\n\n${description}\n\n`;
      if (team) prompt += `**团队规模**：${team}\n\n`;
      prompt += `## 估算要求\n\n`;
      prompt += `请按以下格式输出工时估算报告（单位：${unitLabel}）：\n\n`;
      prompt += `1. **任务拆解**：将任务拆解为子任务，分别估算\n`;
      prompt += `2. **三点估算**（每个子任务）：\n`;
      prompt += `   - 乐观（O）：一切顺利的情况\n`;
      prompt += `   - 正常（M）：常规工作节奏\n`;
      prompt += `   - 悲观（P）：遇到阻力或不确定因素\n`;
      prompt += `   - 加权平均（E = (O + 4M + P) / 6）\n`;
      prompt += `3. **T-shirt Size**：XS / S / M / L / XL / XXL\n`;
      prompt += `4. **风险项**：列出可能影响估算的不确定因素\n`;
      prompt += `5. **总计**：所有子任务加权平均之和\n\n`;
      prompt += `> 注意：估算基于正常工作节奏，不含代码审查和 QA 时间（除非任务描述中明确包含）`;

      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_git_commit ──────────────────────────────────────────────────
    if (name === 'ethan_git_commit') {
      const cwd = (args?.cwd as string) || process.cwd();
      const hint = ((args?.hint as string) || '').trim();

      if (!isGitRepo(cwd)) {
        return {
          content: [{ type: 'text', text: `❌ ${cwd} 不是 git 仓库，请在 git 项目目录中运行。` }],
          isError: true,
        };
      }

      const diff = getStagedDiff(cwd);
      if (!diff.trim()) {
        return {
          content: [{ type: 'text', text: '⚠️ 暂存区为空（没有 staged 的文件）。请先 `git add` 需要提交的文件。' }],
        };
      }

      const truncated = truncateDiff(diff, 6000);
      let prompt = `# 生成 Conventional Commit 提交信息\n\n`;
      if (hint) prompt += `**业务背景**：${hint}\n\n`;
      prompt += `## Staged 变更\n\n\`\`\`diff\n${truncated}\n\`\`\`\n\n`;
      prompt += `## 要求\n\n`;
      prompt += `请根据以上 diff 生成符合 **Conventional Commits** 规范的提交信息：\n\n`;
      prompt += `格式：\`type(scope): subject\`\n\n`;
      prompt += `- **type**: feat | fix | refactor | perf | test | docs | chore | style | ci | build\n`;
      prompt += `- **scope**: 变更模块（可选，用括号包裹）\n`;
      prompt += `- **subject**: 简洁描述（英文小写，不超过 50 字符，不加句号）\n`;
      prompt += `- **body**（可选）：详细说明 What/Why，每行不超过 72 字符\n`;
      prompt += `- **BREAKING CHANGE**（如有）：在 footer 中注明\n\n`;
      prompt += `请直接输出最终提交信息（可提供 2-3 个候选，按推荐度排序）：`;

      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_git_review ──────────────────────────────────────────────────
    if (name === 'ethan_git_review') {
      const cwd = (args?.cwd as string) || process.cwd();
      const base = (args?.base as string) || '';

      if (!isGitRepo(cwd)) {
        return {
          content: [{ type: 'text', text: `❌ ${cwd} 不是 git 仓库，请在 git 项目目录中运行。` }],
          isError: true,
        };
      }

      const diff = getBranchDiff(cwd, base || undefined);
      if (!diff.trim()) {
        return {
          content: [{ type: 'text', text: '⚠️ 当前分支与基准分支没有差异，无需 Code Review。' }],
        };
      }

      const truncated = truncateDiff(diff, 7000);
      let prompt = `# Code Review — Blocker / Major / Minor\n\n`;
      prompt += `## 变更 Diff\n\n\`\`\`diff\n${truncated}\n\`\`\`\n\n`;
      prompt += `## 审查要求\n\n`;
      prompt += `请对以上变更进行系统性 Code Review，按以下分级输出问题：\n\n`;
      prompt += `### 🔴 Blocker（阻断合并）\n必须修复才能合并，如：逻辑错误、安全漏洞、数据丢失风险\n\n`;
      prompt += `### 🟠 Major（强烈建议修复）\n不会直接阻断合并，但影响代码质量，如：性能问题、可维护性差、不符合最佳实践\n\n`;
      prompt += `### 🟡 Minor（可以忽略）\n小改进建议，如：命名优化、注释补充、代码风格\n\n`;
      prompt += `### ✅ 亮点\n值得表扬的优秀设计或实现\n\n`;
      prompt += `---\n\n请逐文件审查，每个问题注明文件路径 + 行号（如可识别），并给出修改建议。`;

      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_autopilot ────────────────────────────────────────────────────
    if (name === 'ethan_autopilot') {
      const pipelineId = ((args?.pipelineId as string) || '').trim();
      const context = ((args?.context as string) || '').trim();
      const isEn = (args?.lang as string) === 'en';
      const withContext = (args?.withContext as boolean) || false;
      const cwd = (args?.cwd as string) || process.cwd();

      if (!pipelineId) {
        const list = PIPELINES.map((p) => `- \`${p.id}\`：${p.name}`).join('\n');
        return {
          content: [{ type: 'text', text: `❌ pipelineId 参数不能为空。\n\n**可用 Pipeline：**\n${list}` }],
          isError: true,
        };
      }

      if (!context) {
        return {
          content: [{ type: 'text', text: '❌ context 参数不能为空，请提供任务描述（如"实现用户登录功能"）。' }],
          isError: true,
        };
      }

      const resolved = resolvePipeline(pipelineId);
      if (!resolved) {
        return {
          content: [{ type: 'text', text: `❌ 未知 Pipeline: ${pipelineId}。可选值：${PIPELINES.map((p) => p.id).join(', ')}` }],
          isError: true,
        };
      }

      const { buildAutopilotPrompt } = await import('../cli/autopilot');
      let snapshot: import('../context/builder').ProjectSnapshot | undefined;
      if (withContext) {
        const { buildProjectSnapshot, loadCachedSnapshot, saveSnapshotCache } = await import('../context/builder');
        snapshot = loadCachedSnapshot(cwd) ?? (() => {
          const s = buildProjectSnapshot(cwd);
          saveSnapshotCache(s, cwd);
          return s;
        })();
      }

      const prompt = buildAutopilotPrompt(resolved.pipeline, resolved.skills, { context, isEn, snapshot });
      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_agent_orchestrate ────────────────────────────────────────────
    if (name === 'ethan_agent_orchestrate') {
      const pipelineId = ((args?.pipelineId as string) || '').trim();
      const context = ((args?.context as string) || '').trim();
      const isEn = (args?.lang as string) === 'en';
      const withContext = (args?.withContext as boolean) || false;
      const cwd = (args?.cwd as string) || process.cwd();

      if (!pipelineId) {
        const list = PIPELINES.map((p) => `- \`${p.id}\`：${p.name}`).join('\n');
        return { content: [{ type: 'text', text: `❌ pipelineId 不能为空。\n\n**可用 Pipeline：**\n${list}` }], isError: true };
      }
      if (!context) {
        return { content: [{ type: 'text', text: '❌ context 不能为空。请描述任务背景。' }], isError: true };
      }

      const resolved = resolvePipeline(pipelineId);
      if (!resolved) {
        return { content: [{ type: 'text', text: `❌ 未找到 Pipeline: ${pipelineId}\n可用值：${PIPELINES.map((p) => p.id).join(', ')}` }], isError: true };
      }

      const { getActiveAgents, buildMultiAgentPrompt } = await import('../agents/index');
      const agents = getActiveAgents(cwd);

      let snapshotBlock: string | undefined;
      if (withContext) {
        const { buildProjectSnapshot, loadCachedSnapshot, saveSnapshotCache, formatSnapshotForPrompt } = await import('../context/builder');
        let snap = loadCachedSnapshot(cwd);
        if (!snap) {
          snap = buildProjectSnapshot(cwd);
          saveSnapshotCache(snap, cwd);
        }
        snapshotBlock = formatSnapshotForPrompt(snap, isEn);
      }

      const prompt = buildMultiAgentPrompt(resolved.pipeline, resolved.skills, agents, {
        context,
        lang: isEn ? 'en' : 'zh',
        snapshot: snapshotBlock,
        mode: ((args?.mode as string) || 'sequential') as 'sequential' | 'parallel' | 'review-loop' | 'consensus',
      });
      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_agent_list ───────────────────────────────────────────────────
    if (name === 'ethan_agent_list') {
      const cwd = (args?.cwd as string) || process.cwd();
      const { getActiveAgents } = await import('../agents/index');
      const agents = getActiveAgents(cwd);

      const lines = [`# 🤖 可用 Agent 列表（共 ${agents.length} 个）\n`];
      for (const agent of agents) {
        lines.push(`## ${agent.emoji} ${agent.name}  [\`${agent.id}\`]`);
        lines.push(`**职责**：${agent.role}`);
        lines.push(`**Skills**（${agent.skillIds.length} 个）：\`${agent.skillIds.join('`, `')}\``);
        lines.push('');
      }
      lines.push('---');
      lines.push('*自定义 Agent 可放置在 `.ethan/agents/*.yaml` 目录，同 ID 覆盖内置 Agent。*');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // ── ethan_agent_show ───────────────────────────────────────────────────
    if (name === 'ethan_agent_show') {
      const agentId = ((args?.agentId as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      if (!agentId) {
        return { content: [{ type: 'text', text: '❌ agentId 不能为空。' }], isError: true };
      }

      const { getActiveAgents } = await import('../agents/index');
      const agents = getActiveAgents(cwd);
      const agent = agents.find((a) => a.id === agentId);

      if (!agent) {
        const ids = agents.map((a) => a.id).join(' | ');
        return {
          content: [{ type: 'text', text: `❌ 未找到 Agent: ${agentId}\n\n可用 ID：${ids}` }],
          isError: true,
        };
      }

      const lines = [
        `# ${agent.emoji} ${agent.name}`,
        '',
        `| 字段 | 值 |`,
        `|------|---|`,
        `| ID | \`${agent.id}\` |`,
        `| 英文名 | ${agent.nameEn} |`,
        `| 职责 | ${agent.role} |`,
        `| Skills 数量 | ${agent.skillIds.length} 个 |`,
        '',
        `## Skills 列表`,
        ...agent.skillIds.map((id, i) => `${i + 1}. \`${id}\``),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // ── ethan_context_snapshot ─────────────────────────────────────────────
    if (name === 'ethan_context_snapshot') {
      const cwd = (args?.cwd as string) || process.cwd();
      const format = ((args?.format as string) || 'markdown') as 'markdown' | 'json';
      const useCache = args?.useCache !== false;

      const { buildProjectSnapshot, loadCachedSnapshot, saveSnapshotCache, formatSnapshotForPrompt } = await import('../context/builder');
      let snapshot = useCache ? loadCachedSnapshot(cwd) : null;
      if (!snapshot) {
        snapshot = buildProjectSnapshot(cwd);
        saveSnapshotCache(snapshot, cwd);
      }

      const text = format === 'json'
        ? JSON.stringify(snapshot, null, 2)
        : formatSnapshotForPrompt(snapshot, false);

      return { content: [{ type: 'text', text }] };
    }

    // ── ethan_spec_proposal ────────────────────────────────────────────────
    if (name === 'ethan_spec_proposal') {
      const description = ((args?.description as string) || '').trim();
      const capability = ((args?.capability as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      if (!description) {
        return {
          content: [{ type: 'text', text: '❌ description 参数不能为空，请提供变更描述（如"新增用户邮箱二次验证功能"）。' }],
          isError: true,
        };
      }

      const { hasOpenSpec, listSpecs, generateChangeId, proposalTemplate, designTemplate, tasksTemplate, specDeltaTemplate } = await import('../spec/index');
      const specs = listSpecs(cwd);
      const changeId = generateChangeId();
      const capabilityList = capability ? capability.split(',').map((c) => c.trim()) : specs.map((s) => s.capability);
      const hasSpec = hasOpenSpec(cwd);

      let prompt = `# Spec Proposal — ${description}\n\n`;
      prompt += `> Change ID: **${changeId}**\n\n`;

      if (!hasSpec) {
        prompt += `> ⚠️ 当前项目未检测到 \`openspec/\` 目录。请先运行 \`ethan spec init <capability>\` 初始化 spec。\n\n`;
      }

      if (specs.length > 0) {
        prompt += `## 现有 Spec 摘要\n\n`;
        for (const spec of specs) {
          const preview = spec.content.split('\n').slice(0, 6).join('\n');
          prompt += `### ${spec.capability}\n\n\`\`\`\n${preview}\n...\n\`\`\`\n\n`;
        }
      }

      prompt += `---\n\n## 请生成以下文件\n\n`;
      prompt += `### openspec/changes/${changeId}/proposal.md\n\n\`\`\`markdown\n${proposalTemplate(changeId, description)}\n\`\`\`\n\n`;
      prompt += `### openspec/changes/${changeId}/design.md\n\n\`\`\`markdown\n${designTemplate(description)}\n\`\`\`\n\n`;
      prompt += `### openspec/changes/${changeId}/tasks.md\n\n\`\`\`markdown\n${tasksTemplate(description)}\n\`\`\`\n\n`;

      for (const cap of capabilityList) {
        prompt += `### openspec/changes/${changeId}/specs/${cap}.md\n\n\`\`\`markdown\n${specDeltaTemplate(cap, description)}\n\`\`\`\n\n`;
      }

      prompt += `---\n\n请根据变更描述和现有 spec 上下文，填充以上模板并保存文件。`;

      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_spec_review ──────────────────────────────────────────────────
    if (name === 'ethan_spec_review') {
      const changeId = ((args?.changeId as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      const { hasOpenSpec, loadLatestChange, listChanges, truncateSpec } = await import('../spec/index');

      if (!hasOpenSpec(cwd)) {
        return {
          content: [{ type: 'text', text: '❌ 当前项目未检测到 `openspec/` 目录。请先运行 `ethan spec init <capability>` 初始化。' }],
          isError: true,
        };
      }

      const changes = listChanges(cwd);
      if (changes.length === 0) {
        return {
          content: [{ type: 'text', text: '⚠️ 未找到任何变更提案（openspec/changes/ 为空）。请先运行 `ethan spec proposal` 创建提案。' }],
        };
      }

      const change = changeId
        ? changes.find((c) => c.id === changeId) ?? loadLatestChange(cwd)
        : loadLatestChange(cwd);

      if (!change) {
        return {
          content: [{ type: 'text', text: `❌ 未找到变更提案：${changeId}。可用 ID：${changes.map((c) => c.id).join(', ')}` }],
          isError: true,
        };
      }

      const { getBranchDiff, truncateDiff, isGitRepo } = await import('../git/utils');
      const diff = isGitRepo(cwd) ? truncateDiff(getBranchDiff(cwd), 6000) : '（非 git 仓库或无代码变更）';

      let prompt = `# Spec Review — ${change.id}\n\n`;
      if (change.proposalContent) {
        prompt += `## 变更提案\n\n${truncateSpec(change.proposalContent, 800)}\n\n`;
      }

      if (change.specDeltas.length > 0) {
        prompt += `## Spec Delta（需求变更）\n\n`;
        for (const delta of change.specDeltas) {
          prompt += `### ${delta.capability}\n\n${truncateSpec(delta.content, 600)}\n\n`;
        }
      }

      prompt += `## 代码变更（Diff）\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n`;
      prompt += `---\n\n`;
      prompt += `## 意图审查任务\n\n`;
      prompt += `请对照上方 spec delta 与代码 diff，执行以下审查：\n\n`;
      prompt += `1. **意图对齐矩阵**：逐条检查每个 spec 需求/场景是否在代码中有对应实现\n\n`;
      prompt += `   | Spec 需求/场景 | 对应代码位置 | 对齐状态 | 说明 |\n`;
      prompt += `   |--------------|------------|---------|------|\n\n`;
      prompt += `2. **偏差分级**：\n`;
      prompt += `   - 🔴 **意图偏差（Critical）**：代码实现与 spec 意图相反或严重不符，必须修复\n`;
      prompt += `   - 🟡 **遗漏需求（Warning）**：spec 中定义但代码未实现的场景或需求\n`;
      prompt += `   - 💡 **超范围实现（Info）**：代码实现了 spec 未定义的功能\n\n`;
      prompt += `3. **审查结论**：是否可以合并，还是需要修复或补充 spec\n\n`;
      prompt += `> 原则：Review intent, not just code。关注需求意图对齐，而非逐行代码细节。`;

      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_spec_validate ────────────────────────────────────────────────
    if (name === 'ethan_spec_validate') {
      const capabilityFilter = ((args?.capability as string) || '').trim();
      const cwd = (args?.cwd as string) || process.cwd();

      const { hasOpenSpec, listSpecs } = await import('../spec/index');

      if (!hasOpenSpec(cwd)) {
        return {
          content: [{ type: 'text', text: '❌ 当前项目未检测到 `openspec/` 目录。请先运行 `ethan spec init <capability>` 初始化。' }],
          isError: true,
        };
      }

      const specs = listSpecs(cwd);
      const filtered = capabilityFilter ? specs.filter((s) => s.capability === capabilityFilter) : specs;

      if (filtered.length === 0) {
        return {
          content: [{ type: 'text', text: capabilityFilter ? `⚠️ 未找到 capability: ${capabilityFilter}` : '⚠️ openspec/specs/ 下没有任何 spec 文件。' }],
        };
      }

      let report = `# Spec 校验报告\n\n`;
      let totalIssues = 0;

      for (const spec of filtered) {
        const issues: string[] = [];
        const content = spec.content;

        if (!content.includes('## Purpose') && !content.includes('## 用途')) {
          issues.push('缺少 `## Purpose` 章节（描述功能用途）');
        }
        if (!content.includes('## Requirements') && !content.includes('## 需求')) {
          issues.push('缺少 `## Requirements` 章节');
        }
        if (!content.includes('## Scenarios') && !content.includes('## 场景')) {
          issues.push('缺少 `## Scenarios` 章节');
        }

        const gwtRegex = /GIVEN[\s\S]*?WHEN[\s\S]*?THEN/i;
        if (content.includes('Scenario') && !gwtRegex.test(content)) {
          issues.push('存在 Scenario 但未使用 GIVEN/WHEN/THEN 格式');
        }

        const reqMatches = content.match(/### REQ-(\d+)/g) || [];
        const reqNums = reqMatches.map((m) => parseInt(m.replace('### REQ-', ''), 10));
        for (let i = 0; i < reqNums.length - 1; i++) {
          if (reqNums[i + 1] !== reqNums[i] + 1) {
            issues.push(`Requirements 编号不连续：REQ-${reqNums[i]} 后为 REQ-${reqNums[i + 1]}`);
          }
        }

        totalIssues += issues.length;
        const icon = issues.length === 0 ? '✅' : issues.length <= 2 ? '⚠️' : '❌';
        report += `## ${icon} ${spec.capability}\n\n`;
        if (issues.length === 0) {
          report += `规范结构完整，无问题。\n\n`;
        } else {
          issues.forEach((issue) => { report += `- ${issue}\n`; });
          report += '\n';
        }
      }

      report += `---\n\n**汇总**：共校验 ${filtered.length} 个 capability，发现 ${totalIssues} 个问题。`;
      if (totalIssues === 0) report += ' 🎉 全部通过！';

      return { content: [{ type: 'text', text: report }] };
    }

    const skillResult = ALL_SKILLS.find((s) => s.nameEn === name);
    if (!skillResult) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Available tools: ${ALL_SKILLS.map((s) => s.nameEn).join(', ')}, ethan_pipeline`,
          },
        ],
        isError: true,
      };
    }

    const context = (args?.context as string) || '';
    const format = ((args?.format as string) || 'full') as 'full' | 'brief';

    if (!context.trim()) {
      return {
        content: [{
          type: 'text',
          text: `❌ context 参数不能为空。\n\n**工具：** ${skillResult.name}\n**说明：** ${skillResult.description}\n\n请提供任务描述或需求上下文作为 context 参数。`,
        }],
        isError: true,
      };
    }

    const result = executeSkill(skillResult, context, format);

    // ── ethan_dora ─────────────────────────────────────────────────────────────
    if (name === 'ethan_dora') {
      const cwd = (args?.cwd as string) || process.cwd();
      const days = (args?.since_days as number) || 30;
      if (!isGitRepo(cwd)) {
        return { content: [{ type: 'text', text: '❌ 当前目录不是 git 仓库' }], isError: true };
      }
      const merges = spawnSync('git', ['log', '--merges', '--oneline', `--since=${days}.days.ago`], { cwd, encoding: 'utf-8' }).stdout ?? '';
      const mergeCount = merges.trim() ? merges.trim().split('\n').length : 0;
      const deployFreq = (mergeCount / days).toFixed(2);
      const freqLevel = mergeCount / days >= 1 ? 'Elite' : mergeCount / days >= 1/7 ? 'High' : mergeCount / days >= 1/30 ? 'Medium' : 'Low';
      const commits = spawnSync('git', ['log', '--oneline', `--since=${days}.days.ago`], { cwd, encoding: 'utf-8' }).stdout ?? '';
      const commitCount = commits.trim() ? commits.trim().split('\n').length : 0;
      const report =
        `# DORA 四键指标报告\n\n**统计范围**: 最近 ${days} 天\n\n` +
        `| 指标 | 数值 | 等级 |\n|------|------|------|\n` +
        `| 部署频率 | ${deployFreq} 次/天（共 ${mergeCount} 次合并） | **${freqLevel}** |\n` +
        `| 提交总数 | ${commitCount} 次 | — |\n\n` +
        `> Elite（每天多次）> High（每天1次）> Medium（每周1次）> Low（每月1次）\n\n` +
        `请分析以上数据，给出工程效能现状评估和 3-5 条改进建议。`;
      return { content: [{ type: 'text', text: report }] };
    }

    // ── ethan_pr_analytics ─────────────────────────────────────────────────────
    if (name === 'ethan_pr_analytics') {
      const cwd = (args?.cwd as string) || process.cwd();
      const days = (args?.days as number) || 30;
      if (!isGitRepo(cwd)) {
        return { content: [{ type: 'text', text: '❌ 当前目录不是 git 仓库' }], isError: true };
      }
      const merges = spawnSync('git', ['log', '--merges', `--since=${days}.days.ago`, '--format=%H %s'], { cwd, encoding: 'utf-8' }).stdout ?? '';
      const mergeLines = merges.trim() ? merges.trim().split('\n') : [];
      const fileChanges: Record<string, number> = {};
      for (const line of mergeLines.slice(0, 10)) {
        const hash = line.split(' ')[0];
        const files = spawnSync('git', ['diff-tree', '--no-commit-id', '-r', '--name-only', hash], { cwd, encoding: 'utf-8' }).stdout ?? '';
        for (const f of files.trim().split('\n').filter(Boolean)) {
          fileChanges[f] = (fileChanges[f] ?? 0) + 1;
        }
      }
      const hotFiles = Object.entries(fileChanges).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([f, n]) => `- ${f} (${n} 次)`).join('\n');
      const report =
        `# PR 分析报告\n\n**统计范围**: 最近 ${days} 天 | **合并 PR 数**: ${mergeLines.length}\n\n` +
        `## 热点文件 Top 10\n\n${hotFiles || '（无数据）'}\n\n` +
        `请分析 PR 模式，给出 PR 规模合理性评估和热点文件优化建议。`;
      return { content: [{ type: 'text', text: report }] };
    }

    // ── ethan_postmortem ───────────────────────────────────────────────────────
    if (name === 'ethan_postmortem') {
      const cwd = (args?.cwd as string) || process.cwd();
      const incidentId = (args?.incident_id as string) || `INC-${Date.now().toString().slice(-6)}`;
      const recentCommits = isGitRepo(cwd)
        ? (spawnSync('git', ['log', '--oneline', '-10'], { cwd, encoding: 'utf-8' }).stdout ?? '')
        : '';
      const prompt =
        `# 故障复盘（Postmortem）— ${incidentId}\n\n` +
        (recentCommits ? `## 近期提交记录\n\n\`\`\`\n${recentCommits}\`\`\`\n\n` : '') +
        `请生成标准化 Postmortem 报告（Google SRE 格式）：\n\n` +
        `1. **事故摘要**：时间线、影响范围、严重程度\n` +
        `2. **根因分析**（5 Why）\n3. **贡献因素**（技术/流程/人员）\n` +
        `4. **时间线**：详细事件序列\n` +
        `5. **后续行动**：P0/P1/P2 改进项（附责任人 + 截止日期）\n` +
        `6. **经验教训**\n\n> 请描述事故经过，我来生成完整复盘报告。`;
      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_scaffold ─────────────────────────────────────────────────────────
    if (name === 'ethan_scaffold') {
      const template = (args?.template as string) || 'react-ts';
      const templates: Record<string, string> = {
        'react-ts': 'React + TypeScript + Vite + Vitest + Tailwind CSS',
        'node-api': 'Node.js + TypeScript + Express/Fastify + Prisma + Jest',
        'cli-tool': 'Node.js CLI + TypeScript + Commander + Vitest',
        'monorepo': 'pnpm Monorepo + Turborepo + TypeScript',
        'library':  'TypeScript Library + Vitest + tsup + Changesets',
      };
      const desc = templates[template] ?? `自定义模板: ${template}`;
      const prompt =
        `# 项目脚手架：${template}\n\n**模板**: ${desc}\n\n` +
        `请生成完整的项目初始结构：\n` +
        `1. **目录结构**（tree 格式，含说明注释）\n` +
        `2. **核心配置文件**：package.json / tsconfig.json / 构建配置\n` +
        `3. **代码规范**：ESLint + Prettier + .editorconfig\n` +
        `4. **Git 配置**：.gitignore / .husky / commitlint\n` +
        `5. **CI 配置**：GitHub Actions（lint + test + build）\n` +
        `6. **入口文件**：最小可运行的 index.ts\n` +
        `7. **README 模板**：含徽章、快速启动、贡献指南\n\n` +
        `> 基于 2025 年最佳实践，使用最新稳定版本依赖。`;
      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_compliance ───────────────────────────────────────────────────────
    if (name === 'ethan_compliance') {
      const std = (args?.standard as string) || 'soc2';
      const standards: Record<string, { name: string; controls: string[] }> = {
        soc2: {
          name: 'SOC 2 Type II',
          controls: [
            '**CC6.1** 逻辑访问控制：MFA、最小权限、访问审查记录',
            '**CC6.6** 网络安全控制：防火墙、TLS、入侵检测',
            '**CC7.1** 系统监控：日志集中管理、异常告警',
            '**CC7.2** 安全事件响应：Incident Response Plan',
            '**A1.1** 可用性：SLA 目标、备份、RTO/RPO',
          ],
        },
        gdpr: {
          name: 'GDPR',
          controls: [
            '**Art. 13/14** 隐私政策：数据收集目的、用户权利',
            '**Art. 17** 删除权：数据删除接口',
            '**Art. 25** 隐私设计：数据最小化',
            '**Art. 30** 处理活动记录（ROPA）',
            '**Art. 33** 数据泄露通知：72小时内报告',
          ],
        },
        iso27001: {
          name: 'ISO 27001:2022',
          controls: [
            '**A.5** 信息安全策略：书面安全政策',
            '**A.8** 资产管理：信息资产清单',
            '**A.9** 访问控制：权限审查',
            '**A.12** 运营安全：变更管理、日志监控',
            '**A.16** 事件管理：事件响应程序',
          ],
        },
      };
      const s = standards[std] ?? standards.soc2;
      const controls = s.controls.map((c) => `- ${c}`).join('\n');
      const prompt =
        `# 合规证据收集 — ${s.name}\n\n## 控制措施清单\n\n${controls}\n\n` +
        `## 任务\n\n` +
        `请为以上每项控制措施：\n` +
        `1. **识别现有证据**：已有哪些文档/配置可作为证据\n` +
        `2. **差距分析**：缺少什么证据（❌ 表示缺失）\n` +
        `3. **证据生成建议**：如何创建缺失证据\n` +
        `4. **优先级排序**：按审计风险排列`;
      return { content: [{ type: 'text', text: prompt }] };
    }

    // ── ethan_upgrade ──────────────────────────────────────────────────────────
    if (name === 'ethan_upgrade') {
      const force = (args?.force as boolean) ?? false;
      const cacheFile = require('path').join(require('os').homedir(), '.ethan-update-cache.json');
      let cacheInfo = '';
      try {
        if (require('fs').existsSync(cacheFile)) {
          const c = JSON.parse(require('fs').readFileSync(cacheFile, 'utf-8'));
          const ageMin = Math.round((Date.now() - c.lastChecked) / 60000);
          cacheInfo = `\n\n**缓存信息**\n- npm 最新版：v${c.latestVersion}\n- 上次检查：${ageMin} 分钟前`;
          if (c.upgradedVersion) cacheInfo += `\n- 已触发升级：v${c.upgradedVersion}`;
        }
      } catch { /* ignore */ }

      const needsUpdate = (() => {
        try {
          if (!require('fs').existsSync(cacheFile)) return false;
          const c = JSON.parse(require('fs').readFileSync(cacheFile, 'utf-8'));
          const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
          const [cMaj, cMin, cPat] = parse(pkg.version);
          const [lMaj, lMin, lPat] = parse(c.latestVersion);
          if (lMaj !== cMaj) return lMaj > cMaj;
          if (lMin !== cMin) return lMin > cMin;
          return lPat > cPat;
        } catch { return false; }
      })();

      const statusIcon = needsUpdate ? '⚠️' : '✅';
      const statusMsg = needsUpdate
        ? `发现新版本可用${force ? '（force 模式）' : ''}` : '已是最新版本';

      const text =
        `# Ethan 版本状态\n\n` +
        `${statusIcon} **${statusMsg}**\n\n` +
        `- 当前版本：v${pkg.version}${cacheInfo}\n\n` +
        (needsUpdate || force
          ? `## 升级方法\n\n在终端运行以下命令进行升级：\n\n\`\`\`bash\nethan upgrade\n# 或强制重装\nethan upgrade --force\n# 或直接使用 npm\nnpm install -g ethan-skill@latest\n\`\`\`\n\n升级完成后重启终端即可使用新版本。`
          : `如需强制重装，在终端运行：\`ethan upgrade --force\``
        );

      return { content: [{ type: 'text', text }] };
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP server 运行时不输出到 stdout（会破坏协议）
  process.stderr.write(
    `Ethan MCP Server v${pkg.version} running (${ALL_SKILLS.length} skill tools + ethan_pipeline + ethan_workflow_next + ethan_workflow_status + ethan_memory_search + ethan_estimate + ethan_git_commit + ethan_git_review + ethan_autopilot + ethan_agent_orchestrate + ethan_agent_list + ethan_agent_show + ethan_context_snapshot + ethan_spec_proposal + ethan_spec_review + ethan_spec_validate + ethan_dora + ethan_pr_analytics + ethan_postmortem + ethan_scaffold + ethan_compliance + ethan_upgrade, ${PIPELINES.length} pipelines)\n`
  );
}

// 直接运行时启动
if (require.main === module) {
  startMcpServer().catch((err) => {
    process.stderr.write(`MCP Server error: ${err}\n`);
    process.exit(1);
  });
}
