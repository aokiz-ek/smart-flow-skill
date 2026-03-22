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

    // Handle pipeline tool
    if (name === 'ethan_pipeline') {
      const pipelineId = (args?.pipeline as string) || '';
      const context = (args?.context as string) || '';
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

    const result = executeSkill(skillResult, context, format);

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
    `Ethan MCP Server v${pkg.version} running (${ALL_SKILLS.length} skill tools + ethan_pipeline + ethan_workflow_next + ethan_workflow_status + ethan_memory_search + ethan_estimate + ethan_git_commit + ethan_git_review, ${PIPELINES.length} pipelines)\n`
  );
}

// 直接运行时启动
if (require.main === module) {
  startMcpServer().catch((err) => {
    process.stderr.write(`MCP Server error: ${err}\n`);
    process.exit(1);
  });
}
