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
import * as fs from 'fs';
import * as path from 'path';

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

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...ALL_SKILLS.map(skillToMcpTool), pipelineTool, workflowNextTool, workflowStatusTool],
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

    const skill = ALL_SKILLS.find((s) => s.nameEn === name);
    if (!skill) {
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

    const result = executeSkill(skill, context, format);

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  });

  // 启动 stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP server 运行时不输出到 stdout（会破坏协议）
  process.stderr.write(
    `Ethan MCP Server v${pkg.version} running (${ALL_SKILLS.length} skill tools + ethan_pipeline + ethan_workflow_next + ethan_workflow_status, ${PIPELINES.length} pipelines)\n`
  );
}

// 直接运行时启动
if (require.main === module) {
  startMcpServer().catch((err) => {
    process.stderr.write(`MCP Server error: ${err}\n`);
    process.exit(1);
  });
}
