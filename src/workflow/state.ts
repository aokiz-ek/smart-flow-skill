/**
 * 工作流会话状态管理
 * 持久化到 .ethan/workflow.json（默认）或 .ethan/sessions/<name>.json（具名会话）
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SkillDefinition, PipelineDefinition } from '../skills/types';

export type StepStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface WorkflowStep {
  skillId: string;
  status: StepStatus;
  /** 用户/AI 填写的本步摘要（作为下一步的上下文输入） */
  summary?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowSession {
  id: string;
  /** 具名会话名称（可选，T12 Named Sessions） */
  name?: string;
  pipelineId: string;
  pipelineName: string;
  /** 用户最初的任务上下文描述 */
  initialContext: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  /** 是否全部完成 */
  completed: boolean;
}

const WORKFLOW_DIR = '.ethan';
const WORKFLOW_FILE = 'workflow.json';
const SESSIONS_DIR = 'sessions';
const CURRENT_SESSION_FILE = 'current-session';

function getWorkflowPath(cwd: string, sessionName?: string): string {
  if (sessionName) {
    return path.join(cwd, WORKFLOW_DIR, SESSIONS_DIR, `${sessionName}.json`);
  }
  return path.join(cwd, WORKFLOW_DIR, WORKFLOW_FILE);
}

/** 读取当前激活的具名会话（workflow use 设置的） */
export function getCurrentSessionName(cwd: string = process.cwd()): string | undefined {
  const filePath = path.join(cwd, WORKFLOW_DIR, CURRENT_SESSION_FILE);
  try {
    if (fs.existsSync(filePath)) {
      const name = fs.readFileSync(filePath, 'utf-8').trim();
      return name || undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** 设置当前激活的具名会话 */
export function setCurrentSessionName(cwd: string = process.cwd(), name: string): void {
  const dir = path.join(cwd, WORKFLOW_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, CURRENT_SESSION_FILE), name, 'utf-8');
}

/** 清除当前激活的具名会话 */
export function clearCurrentSessionName(cwd: string = process.cwd()): void {
  const filePath = path.join(cwd, WORKFLOW_DIR, CURRENT_SESSION_FILE);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** 读取当前 session（支持具名会话，优先级：显式 name > current-session 文件 > 默认 workflow.json） */
export function loadSession(cwd: string = process.cwd(), sessionName?: string): WorkflowSession | null {
  const effectiveName = sessionName ?? getCurrentSessionName(cwd);
  const filePath = getWorkflowPath(cwd, effectiveName);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorkflowSession;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 保存 session（支持具名会话） */
export function saveSession(session: WorkflowSession, cwd: string = process.cwd(), sessionName?: string): void {
  const name = sessionName || session.name;
  const filePath = getWorkflowPath(cwd, name);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

/** 删除 session（reset，支持具名会话） */
export function deleteSession(cwd: string = process.cwd(), sessionName?: string): void {
  const filePath = getWorkflowPath(cwd, sessionName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** 列出所有具名会话 */
export function listNamedSessions(cwd: string = process.cwd()): WorkflowSession[] {
  const sessionsDir = path.join(cwd, WORKFLOW_DIR, SESSIONS_DIR);
  if (!fs.existsSync(sessionsDir)) return [];
  return fs
    .readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8')) as WorkflowSession;
      } catch {
        return null;
      }
    })
    .filter((s): s is WorkflowSession => s !== null);
}

/** 创建新 session（支持具名会话） */
export function createSession(
  pipeline: PipelineDefinition,
  initialContext: string,
  cwd: string = process.cwd(),
  sessionName?: string
): WorkflowSession {
  const session: WorkflowSession = {
    id: Date.now().toString(36),
    name: sessionName,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    initialContext,
    steps: pipeline.skillIds.map((skillId, i) => ({
      skillId,
      status: i === 0 ? 'in-progress' : 'pending',
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: false,
  };
  saveSession(session, cwd, sessionName);
  return session;
}

/** 获取当前进行中的步骤（第一个 in-progress 或 pending） */
export function getCurrentStep(session: WorkflowSession): WorkflowStep | null {
  return (
    session.steps.find((s) => s.status === 'in-progress') ??
    session.steps.find((s) => s.status === 'pending') ??
    null
  );
}

/** 获取当前步骤序号（0-based） */
export function getCurrentStepIndex(session: WorkflowSession): number {
  const step = getCurrentStep(session);
  if (!step) return -1;
  return session.steps.indexOf(step);
}

/** 标记当前步骤完成，推进到下一步，返回新的当前步骤（若无则 null） */
export function markStepDone(
  session: WorkflowSession,
  summary: string = '',
  cwd: string = process.cwd()
): WorkflowStep | null {
  const idx = getCurrentStepIndex(session);
  if (idx === -1) return null;

  session.steps[idx].status = 'done';
  session.steps[idx].summary = summary;
  session.steps[idx].completedAt = new Date().toISOString();

  const nextIdx = idx + 1;
  if (nextIdx < session.steps.length) {
    session.steps[nextIdx].status = 'in-progress';
    session.steps[nextIdx].startedAt = new Date().toISOString();
  } else {
    session.completed = true;
  }

  saveSession(session, cwd, session.name);
  return nextIdx < session.steps.length ? session.steps[nextIdx] : null;
}

/**
 * 构建某步骤的执行提示词
 * 自动携带：初始任务上下文 + 上一步摘要链
 */
export function buildStepPrompt(
  session: WorkflowSession,
  step: WorkflowStep,
  skill: SkillDefinition
): string {
  const stepIdx = session.steps.indexOf(step);

  // 汇总已完成步骤的摘要
  const prevSummaries = session.steps
    .slice(0, stepIdx)
    .filter((s) => s.status === 'done' && s.summary)
    .map((s, i) => `**步骤 ${i + 1} 产出（${s.skillId}）**：\n${s.summary}`)
    .join('\n\n');

  const lines: string[] = [
    `# 工作流：${session.pipelineName}`,
    `## 当前步骤：${skill.name}（${stepIdx + 1}/${session.steps.length}）`,
    '',
    `**任务背景**：${session.initialContext}`,
  ];

  if (prevSummaries) {
    lines.push('', '**前序步骤产出**：', prevSummaries);
  }

  lines.push(
    '',
    `**本步目标**：${skill.description}`,
    '',
    '**执行步骤**：',
    ...skill.steps.map((s, i) => `${i + 1}. ${s.title.replace(/^\d+\.\s*/, '')}`),
    '',
    `**输出格式**：${skill.outputFormat}`,
    '',
    '---',
    `> 完成本步后，运行 \`ethan workflow done\` 推进到下一步（可选摘要：\`ethan workflow done "你的摘要"\`）`
  );

  return lines.join('\n');
}

/** 计算进度百分比 */
export function calcProgress(session: WorkflowSession): number {
  const done = session.steps.filter((s) => s.status === 'done').length;
  return Math.round((done / session.steps.length) * 100);
}
