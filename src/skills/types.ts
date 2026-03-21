/**
 * 整个架构的数据契约（Single Source of Truth）
 * 所有平台的规则文件均从此接口生成
 */

export interface SkillStep {
  /** 步骤标题 */
  title: string;
  /** 步骤详细说明（Markdown 格式） */
  content: string;
}

export interface SkillExample {
  /** 示例输入/触发场景 */
  input: string;
  /** 示例输出/期望结果 */
  output: string;
}

export interface SkillDefinition {
  /** 唯一标识符，用于 MCP tool name 和文件名 */
  id: string;
  /** 显示名称（中文） */
  name: string;
  /** 英文名称，用于 MCP tool name */
  nameEn: string;
  /** 简短描述（一句话），用于 MCP tool description */
  description: string;
  /** 详细描述，用于规则文件头部 */
  detailDescription: string;
  /** 触发关键词列表（用于路由匹配） */
  triggers: string[];
  /** 执行步骤（有序） */
  steps: SkillStep[];
  /** 输出格式说明 */
  outputFormat: string;
  /** 使用示例（可选） */
  examples?: SkillExample[];
  /** 注意事项（可选） */
  notes?: string[];
  /** Skill 排序序号（1-based） */
  order: number;
  /** Skill 所属分类（可选） */
  category?: '需求侧' | '执行侧' | '跟踪侧' | '输出侧' | '质量侧';
  /** 推荐的下一个 Skill ID（可选） */
  nextSkill?: string;
}

export type Platform =
  | 'cursor-new'    // .cursor/rules/*.mdc（含 YAML frontmatter）
  | 'cursor-old'    // .cursorrules（纯文本兼容）
  | 'copilot'       // .github/copilot-instructions.md
  | 'cline'         // .clinerules
  | 'lingma'        // .lingma/rules/*.md
  | 'codebuddy'     // CODEBUDDY.md
  | 'windsurf'      // .windsurf/rules/smart-flow.md
  | 'zed'           // smart-flow.rules
  | 'jetbrains'     // .github/ai-instructions.md
  | 'continue'      // .continuerules
  | 'claude-code';  // CLAUDE.md

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  skillIds: string[];
}

export interface BuildContext {
  platform: Platform;
  skills: SkillDefinition[];
  /** 生成时间（ISO 字符串） */
  generatedAt: string;
  /** 包版本 */
  version: string;
}
