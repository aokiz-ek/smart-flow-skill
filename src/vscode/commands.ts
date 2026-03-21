import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_SKILLS } from '../skills/index';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ethan.install', installRules),
    vscode.commands.registerCommand('ethan.listSkills', listSkills)
  );
}

/**
 * 将规则文件安装到当前工作区
 */
async function installRules(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace first.');
    return;
  }

  const platform = await vscode.window.showQuickPick(
    [
      { label: 'All Platforms', value: 'all' },
      { label: 'Cursor (New .mdc)', value: 'cursor' },
      { label: 'VS Code Copilot', value: 'copilot' },
      { label: 'Cline', value: 'cline' },
      { label: '通义灵码 (Lingma)', value: 'lingma' },
      { label: '腾讯 CodeBuddy', value: 'codebuddy' },
    ],
    { placeHolder: 'Select target platform' }
  );

  if (!platform) return;

  const targetDir = workspaceFolders[0].uri.fsPath;
  const rulesDir = path.join(context_getExtensionPath(), 'rules');

  const installMap: Record<string, Array<{ src: string; dest: string }>> = {
    cursor: [
      {
        src: path.join(rulesDir, 'cursor/smart-flow.mdc'),
        dest: path.join(targetDir, '.cursor/rules/smart-flow.mdc'),
      },
    ],
    copilot: [
      {
        src: path.join(rulesDir, 'copilot/copilot-instructions.md'),
        dest: path.join(targetDir, '.github/copilot-instructions.md'),
      },
    ],
    cline: [
      {
        src: path.join(rulesDir, 'cline/.clinerules'),
        dest: path.join(targetDir, '.clinerules'),
      },
    ],
    lingma: [
      {
        src: path.join(rulesDir, 'lingma/smart-flow.md'),
        dest: path.join(targetDir, '.lingma/rules/smart-flow.md'),
      },
    ],
    codebuddy: [
      {
        src: path.join(rulesDir, 'codebuddy/CODEBUDDY.md'),
        dest: path.join(targetDir, 'CODEBUDDY.md'),
      },
    ],
  };

  const targets =
    platform.value === 'all'
      ? Object.values(installMap).flat()
      : installMap[platform.value] ?? [];

  let installed = 0;
  for (const { src, dest } of targets) {
    if (!fs.existsSync(src)) continue;
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    installed++;
  }

  vscode.window.showInformationMessage(
    `Ethan: Installed ${installed} rule file(s). Restart your AI editor to apply.`
  );
}

/**
 * 展示所有可用 Skill 列表
 */
async function listSkills(): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'ethanSkills',
    'Ethan Skills',
    vscode.ViewColumn.One,
    {}
  );

  const rows = ALL_SKILLS.map(
    (s) => `
    <tr>
      <td>${s.order}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.description}</td>
      <td>${s.triggers.slice(0, 3).map((t) => `<code>${t}</code>`).join(' ')}</td>
    </tr>`
  ).join('');

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border: 1px solid var(--vscode-panel-border); text-align: left; }
    th { background: var(--vscode-editor-selectionBackground); }
    code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Ethan Skills</h1>
  <table>
    <thead><tr><th>#</th><th>Skill</th><th>描述</th><th>触发词</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

// 辅助：获取扩展根路径（在命令函数中无法直接访问 context）
let _extensionPath = '';
function context_getExtensionPath(): string {
  return _extensionPath;
}

export function setExtensionPath(p: string): void {
  _extensionPath = p;
}
