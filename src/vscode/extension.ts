import * as vscode from 'vscode';
import { ALL_SKILLS } from '../skills/index';
import { routeTrigger } from '../router/trigger-router';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  // 注册命令
  registerCommands(context);

  // 注册 Chat Participant（@smartflow）
  const participant = vscode.chat.createChatParticipant(
    'smartflow',
    handleChatRequest
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'assets',
    'icon.png'
  );

  context.subscriptions.push(participant);
}

async function handleChatRequest(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  const userMessage = request.prompt.trim();

  // 根据命令名（/需求理解 等）或触发词路由
  let skill = null;

  if (request.command) {
    // 用户通过 /命令 显式指定了 Skill
    skill = ALL_SKILLS.find(
      (s) =>
        s.name === request.command ||
        s.nameEn === request.command ||
        s.triggers.includes('/' + request.command)
    );
  }

  if (!skill && userMessage) {
    const routeResult = routeTrigger(userMessage);
    skill = routeResult?.skill ?? null;
  }

  if (!skill) {
    // 未匹配到 Skill，显示帮助信息
    stream.markdown('## Smart Flow Skills\n\n');
    stream.markdown('可用 Skill（输入对应触发词或使用 `/命令`）：\n\n');
    for (const s of ALL_SKILLS) {
      stream.markdown(`- **${s.name}**：${s.description}\n`);
      stream.markdown(`  触发词：\`${s.triggers.slice(0, 3).join('\`、\`')}\`\n\n`);
    }
    return;
  }

  if (token.isCancellationRequested) return;

  // 输出 Skill 执行内容
  stream.markdown(`# 执行 Skill：${skill.name}\n\n`);
  stream.markdown(`> ${skill.detailDescription}\n\n`);

  if (userMessage) {
    stream.markdown(`**输入**：${userMessage}\n\n---\n\n`);
  }

  for (const step of skill.steps) {
    if (token.isCancellationRequested) return;
    stream.markdown(`${step.title}\n\n${step.content}\n\n`);
  }

  stream.markdown(`---\n\n**输出格式**：${skill.outputFormat}\n`);

  if (skill.notes && skill.notes.length > 0) {
    stream.markdown(`\n**注意事项**：\n`);
    for (const note of skill.notes) {
      stream.markdown(`- ${note}\n`);
    }
  }
}

export function deactivate(): void {}
