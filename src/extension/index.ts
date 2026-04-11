/**
 * Ethan Extension System
 * 提供事件钩子、Webhook、热加载和扩展 SDK
 *
 * 配置文件：.ethan/extensions.json
 * 钩子文件：.ethan/hooks/*.ts|js
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────
export interface EthanEvent {
  type: EthanEventType;
  skillId?: string;
  pipelineId?: string;
  agentId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  cwd: string;
}

export type EthanEventType =
  | 'before:skill'
  | 'after:skill'
  | 'before:pipeline'
  | 'after:pipeline'
  | 'before:agent'
  | 'after:agent'
  | 'memory:save'
  | 'memory:search'
  | 'workflow:start'
  | 'workflow:done'
  | 'error';

export interface EthanHook {
  event: EthanEventType | EthanEventType[];
  handler: (event: EthanEvent) => void | Promise<void>;
  name?: string;
}

export interface WebhookConfig {
  url: string;
  events: EthanEventType[];
  headers?: Record<string, string>;
  secret?: string;
  enabled: boolean;
}

export interface ExtensionsConfig {
  version: 1;
  hooks: Array<{ file: string; enabled: boolean }>;
  webhooks: WebhookConfig[];
  hotReload?: boolean;
}

// ─── 全局钩子注册表 ───────────────────────────────────────────────────────────
const _hooks: EthanHook[] = [];

export const EthanExtension = {
  /** 注册事件钩子 */
  on(event: EthanEventType | EthanEventType[], handler: EthanHook['handler'], name?: string) {
    _hooks.push({ event, handler, name });
  },

  /** 取消注册钩子 */
  off(name: string) {
    const idx = _hooks.findIndex((h) => h.name === name);
    if (idx > -1) _hooks.splice(idx, 1);
  },

  /** 获取所有已注册钩子 */
  listHooks(): EthanHook[] {
    return [..._hooks];
  },
};

// ─── 事件触发器 ───────────────────────────────────────────────────────────────
export async function emit(event: EthanEvent): Promise<void> {
  // 1. 内存钩子
  for (const hook of _hooks) {
    const events = Array.isArray(hook.event) ? hook.event : [hook.event];
    if (events.includes(event.type)) {
      try {
        await hook.handler(event);
      } catch (e) {
        // 钩子错误不阻断主流程
        console.error(`[ethan:hook] Error in hook "${hook.name ?? 'anonymous'}":`, e);
      }
    }
  }

  // 2. Webhook 推送（异步，不阻断）
  const webhooks = loadWebhooks(event.cwd);
  for (const wh of webhooks.filter((w) => w.enabled && w.events.includes(event.type))) {
    sendWebhook(wh, event).catch(() => {
      // Webhook 失败不影响主流程
    });
  }
}

// ─── 外部钩子文件加载 ─────────────────────────────────────────────────────────
/** 从 .ethan/hooks/ 目录加载 JS 钩子文件 */
export async function loadHookFiles(cwd: string): Promise<void> {
  const hooksDir = path.join(cwd, '.ethan', 'hooks');
  if (!fs.existsSync(hooksDir)) return;

  const files = fs.readdirSync(hooksDir).filter((f) => /\.(js|mjs|cjs)$/.test(f));
  for (const file of files) {
    try {
      const mod = await import(path.join(hooksDir, file));
      if (typeof mod.default === 'function') {
        mod.default(EthanExtension);
      } else if (typeof mod.register === 'function') {
        mod.register(EthanExtension);
      }
    } catch (e) {
      console.error(`[ethan:hooks] Failed to load ${file}:`, e);
    }
  }
}

// ─── Webhook ─────────────────────────────────────────────────────────────────
function loadWebhooks(cwd: string): WebhookConfig[] {
  const configFile = path.join(cwd, '.ethan', 'extensions.json');
  if (!fs.existsSync(configFile)) return [];
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as ExtensionsConfig;
    return cfg.webhooks ?? [];
  } catch {
    return [];
  }
}

async function sendWebhook(wh: WebhookConfig, event: EthanEvent): Promise<void> {
  const body = JSON.stringify({ event });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Ethan-Extension/1.0',
    ...(wh.headers ?? {}),
  };

  // 签名（HMAC-SHA256，使用 secret 时）
  if (wh.secret) {
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', wh.secret).update(body).digest('hex');
    headers['X-Ethan-Signature'] = `sha256=${sig}`;
  }

  // 使用 Node.js 内置 fetch（Node 18+）
  const fetchFn = globalThis.fetch ?? (await import('node:http').then(() => null));
  if (!fetchFn) return;

  await (globalThis.fetch as typeof fetch)(wh.url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  });
}

// ─── 扩展配置 CLI 辅助 ────────────────────────────────────────────────────────
export function readExtensionsConfig(cwd: string): ExtensionsConfig {
  const file = path.join(cwd, '.ethan', 'extensions.json');
  if (!fs.existsSync(file)) {
    return { version: 1, hooks: [], webhooks: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as ExtensionsConfig;
  } catch {
    return { version: 1, hooks: [], webhooks: [] };
  }
}

export function writeExtensionsConfig(config: ExtensionsConfig, cwd: string): void {
  const dir = path.join(cwd, '.ethan');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'extensions.json'),
    JSON.stringify(config, null, 2),
    'utf-8',
  );
}

/** 生成示例钩子文件 */
export function generateHookTemplate(cwd: string, name: string): string {
  const hooksDir = path.join(cwd, '.ethan', 'hooks');
  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

  const file = path.join(hooksDir, `${name}.js`);
  const template = `/**
 * Ethan Extension Hook: ${name}
 * 在此注册事件钩子，响应 Ethan 工作流事件
 */

/** @param {import('smart-flow-skill/extension').EthanExtensionAPI} ethan */
export function register(ethan) {
  // 在 Skill 执行后触发
  ethan.on('after:skill', (event) => {
    console.log('[hook:${name}] Skill 执行完成:', event.skillId);
    // 可以在这里发送通知、记录日志、触发外部服务等
  });

  // 在工作流结束后触发
  ethan.on('workflow:done', (event) => {
    console.log('[hook:${name}] 工作流完成:', event.pipelineId);
  });
}
`;
  fs.writeFileSync(file, template, 'utf-8');
  return file;
}
