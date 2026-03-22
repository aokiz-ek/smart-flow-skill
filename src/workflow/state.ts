/**
 * 工作流会话状态管理
 * 持久化到 .ethan/workflow.json
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

function getWorkflowPath(cwd: string): string {
  return path.join(cwd, WORKFLOW_DIR, WORKFLOW_FILE);
}

/** 读取当前 session */
export function loadSession(cwd: string = process.cwd()): WorkflowSession | null {
  const filePath = getWorkflowPath(cwd);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorkflowSession;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 保存 session */
export function saveSession(session: WorkflowSession, cwd: string = process.cwd()): void {
  const dir = path.join(cwd, WORKFLOW_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(getWorkflowPath(cwd), JSON.stringify(session, null, 2), 'utf-8');
}

/** 删除 session（reset） */
export function deleteSession(cwd: string = process.cwd()): void {
  const filePath = getWorkflowPath(cwd);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** 创建新 session */
export function createSession(
  pipeline: PipelineDefinition,
  initialContext: string,
  cwd: string = process.cwd()
): WorkflowSession {
  const session: WorkflowSession = {
    id: Date.now().toString(36),
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
  saveSession(session, cwd);
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
  summary: string,
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

  saveSession(session, cwd);
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
    `> 完成本步后，运行 \`ethan workflow done "你的摘要"\` 进入下一步`
  );

  return lines.join('\n');
}

/** 计算进度百分比 */
export function calcProgress(session: WorkflowSession): number {
  const done = session.steps.filter((s) => s.status === 'done').length;
  return Math.round((done / session.steps.length) * 100);
}
