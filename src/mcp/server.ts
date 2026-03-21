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
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ALL_SKILLS } from '../skills/index';
import { SkillDefinition } from '../skills/types';
import { PIPELINES, resolvePipeline } from '../skills/pipeline';
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

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...ALL_SKILLS.map(skillToMcpTool), pipelineTool],
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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
    `Ethan MCP Server v${pkg.version} running (${ALL_SKILLS.length} skill tools + 1 pipeline tool, ${PIPELINES.length} pipelines)\n`
  );
}

// 直接运行时启动
if (require.main === module) {
  startMcpServer().catch((err) => {
    process.stderr.write(`MCP Server error: ${err}\n`);
    process.exit(1);
  });
}
