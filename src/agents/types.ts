/**
 * Multi-Agent 编排系统 — 类型定义
 * Agent = 有角色定位的 Skill 执行者，多个 Agent 协作完成复杂工作流
 */

export interface AgentDefinition {
  /** 唯一标识符 */
  id: string;
  /** 显示名称（中文），如 "Architect Agent" */
  name: string;
  /** 英文名称 */
  nameEn: string;
  /** 角色 Emoji，如 "🏗️" */
  emoji: string;
  /** 角色职责描述（一句话），如 "负责需求分析、系统设计、技术方案" */
  role: string;
  /** 此 Agent 可执行的 Skill ID 列表 */
  skillIds: string[];
}

/** Agent 协作模式 */
export type AgentCollaborationMode =
  | 'sequential'   // 默认：按步骤顺序 Agent 交替执行（原逻辑）
  | 'parallel'     // 各 Agent 同时分析各自维度，最后汇总
  | 'review-loop'  // coder 实现 → reviewer 审查 → coder 修改（最多 2 轮）
  | 'consensus';   // 多 Agent 各自独立提案，最后共识整合

export interface AgentOrchestrationOptions {
  /** 任务背景描述 */
  context: string;
  /** 输出语言，默认 zh */
  lang?: 'zh' | 'en';
  /** 是否注入 ProjectSnapshot */
  withContext?: boolean;
  /** ProjectSnapshot 的格式化字符串（已渲染） */
  snapshot?: string;
  /** Agent 协作模式，默认 sequential */
  mode?: AgentCollaborationMode;
}
