import * as vscode from 'vscode';
import { ALL_SKILLS } from '../skills/index';
import { routeTrigger } from '../router/trigger-router';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  // Register commands and get back the tree-data providers + status bar item
  const { skillsProvider, pipelinesProvider, statusBarItem } =
    registerCommands(context);

  // Register sidebar tree views
  context.subscriptions.push(
    vscode.window.createTreeView('ethan.skillsView', {
      treeDataProvider: skillsProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('ethan.pipelinesView', {
      treeDataProvider: pipelinesProvider,
    }),
    statusBarItem
  );

  // Register Chat Participant (@ethan)
  const participant = vscode.chat.createChatParticipant(
    'ethan',
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

  // Route by explicit /command name or by trigger keyword in the message
  let skill = null;

  if (request.command) {
    // User explicitly selected a Skill via /命令
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
    // No matching Skill — show the help list
    stream.markdown('## Ethan Skills\n\n');
    stream.markdown('可用 Skill（输入对应触发词或使用 `/命令`）：\n\n');
    for (const s of ALL_SKILLS) {
      stream.markdown(`- **${s.name}**：${s.description}\n`);
      stream.markdown(
        '  触发词：`' + s.triggers.slice(0, 3).join('`、`') + '`\n\n'
      );
    }
    return;
  }

  if (token.isCancellationRequested) return;

  // Stream the Skill execution content
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
