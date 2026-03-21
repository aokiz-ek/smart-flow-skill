import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { ALL_SKILLS } from '../skills/index';
import { PIPELINES } from '../skills/pipeline';
import type { SkillDefinition, PipelineDefinition } from '../skills/types';

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

/**
 * A category grouping node in the Skills tree (e.g. "需求侧", "执行侧").
 */
class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly categoryName: string,
    public readonly skills: SkillDefinition[]
  ) {
    super(categoryName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('symbol-namespace');
    this.contextValue = 'category';
    this.description = `${skills.length} skills`;
  }
}

/**
 * A leaf node representing a single Skill in the Skills tree.
 */
class SkillTreeItem extends vscode.TreeItem {
  constructor(public readonly skill: SkillDefinition) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);
    this.description = skill.description;
    this.tooltip = new vscode.MarkdownString(
      `**${skill.name}**\n\n${skill.detailDescription}`
    );
    this.iconPath = new vscode.ThemeIcon('symbol-method');
    this.contextValue = 'skill';
    this.command = {
      command: 'ethan.runSkill',
      title: 'Run Skill',
      arguments: [skill.id],
    };
  }
}

/**
 * A pipeline root node in the Pipelines tree.
 */
class PipelineTreeItem extends vscode.TreeItem {
  constructor(public readonly pipeline: PipelineDefinition) {
    super(pipeline.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = pipeline.description;
    this.tooltip = pipeline.description;
    this.iconPath = new vscode.ThemeIcon('symbol-event');
    this.contextValue = 'pipeline';
  }
}

/**
 * A child node inside a pipeline showing a skill step.
 */
class PipelineSkillStepItem extends vscode.TreeItem {
  constructor(
    public readonly skillId: string,
    public readonly index: number
  ) {
    const skill = ALL_SKILLS.find((s) => s.id === skillId);
    const label = skill ? `${index + 1}. ${skill.name}` : `${index + 1}. ${skillId}`;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = skill?.description ?? '';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
    this.contextValue = 'pipelineStep';
  }
}

// ---------------------------------------------------------------------------
// SkillTreeDataProvider
// ---------------------------------------------------------------------------

/** Groups skills by category and exposes them as a VS Code tree. */
export class SkillTreeDataProvider
  implements vscode.TreeDataProvider<CategoryTreeItem | SkillTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    CategoryTreeItem | SkillTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /** Force the tree to re-render. */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(
    element: CategoryTreeItem | SkillTreeItem
  ): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: CategoryTreeItem | SkillTreeItem
  ): Array<CategoryTreeItem | SkillTreeItem> {
    if (!element) {
      // Root level: return category nodes in canonical order
      return this._buildCategoryNodes();
    }

    if (element instanceof CategoryTreeItem) {
      return element.skills.map((s) => new SkillTreeItem(s));
    }

    return [];
  }

  private _buildCategoryNodes(): CategoryTreeItem[] {
    const categoryOrder: Array<SkillDefinition['category']> = [
      '需求侧',
      '执行侧',
      '跟踪侧',
      '输出侧',
      '质量侧',
    ];

    const map = new Map<string, SkillDefinition[]>();
    for (const cat of categoryOrder) {
      if (cat) map.set(cat, []);
    }

    for (const skill of ALL_SKILLS) {
      const cat = skill.category ?? '其他';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(skill);
    }

    const nodes: CategoryTreeItem[] = [];
    for (const [cat, skills] of map) {
      if (skills.length > 0) {
        nodes.push(new CategoryTreeItem(cat, skills));
      }
    }
    return nodes;
  }
}

// ---------------------------------------------------------------------------
// PipelineTreeDataProvider
// ---------------------------------------------------------------------------

/** Exposes pipelines as a VS Code tree with skill-step children. */
export class PipelineTreeDataProvider
  implements
    vscode.TreeDataProvider<PipelineTreeItem | PipelineSkillStepItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    PipelineTreeItem | PipelineSkillStepItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(
    element: PipelineTreeItem | PipelineSkillStepItem
  ): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: PipelineTreeItem | PipelineSkillStepItem
  ): Array<PipelineTreeItem | PipelineSkillStepItem> {
    if (!element) {
      return PIPELINES.map((p) => new PipelineTreeItem(p));
    }

    if (element instanceof PipelineTreeItem) {
      const pipeline = PIPELINES.find((p) => p.id === element.pipeline.id);
      if (!pipeline) return [];
      return pipeline.skillIds.map(
        (skillId, index) => new PipelineSkillStepItem(skillId, index)
      );
    }

    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Module-level storage for the extension path (context is unavailable inside plain functions). */
let _extensionPath = '';
function context_getExtensionPath(): string {
  return _extensionPath;
}
export function setExtensionPath(p: string): void {
  _extensionPath = p;
}

// ---------------------------------------------------------------------------
// Install rules
// ---------------------------------------------------------------------------

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
      { label: 'Windsurf', value: 'windsurf' },
      { label: 'Zed', value: 'zed' },
      { label: 'JetBrains AI', value: 'jetbrains' },
      { label: 'Continue', value: 'continue' },
      { label: 'Claude Code', value: 'claude-code' },
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
    windsurf: [
      {
        src: path.join(rulesDir, 'windsurf/.windsurf/rules/smart-flow.md'),
        dest: path.join(targetDir, '.windsurf/rules/smart-flow.md'),
      },
    ],
    zed: [
      {
        src: path.join(rulesDir, 'zed/smart-flow.rules'),
        dest: path.join(targetDir, '.zed/smart-flow.rules'),
      },
    ],
    jetbrains: [
      {
        src: path.join(rulesDir, 'jetbrains/smart-flow.md'),
        dest: path.join(targetDir, '.github/ai-instructions.md'),
      },
    ],
    continue: [
      {
        src: path.join(rulesDir, 'continue/.continuerules'),
        dest: path.join(targetDir, '.continuerules'),
      },
    ],
    'claude-code': [
      {
        src: path.join(rulesDir, 'claude-code/CLAUDE.md'),
        dest: path.join(targetDir, 'CLAUDE.md'),
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

// ---------------------------------------------------------------------------
// List skills (webview)
// ---------------------------------------------------------------------------

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
      <td>${s.triggers
        .slice(0, 3)
        .map((t) => `<code>${t}</code>`)
        .join(' ')}</td>
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

// ---------------------------------------------------------------------------
// Run skill (QuickPick + clipboard)
// ---------------------------------------------------------------------------

async function runSkill(preselectedId?: string): Promise<void> {
  let skillId = preselectedId;

  if (!skillId) {
    const items = ALL_SKILLS.map((s) => ({
      label: s.name,
      detail: s.description,
      description: s.category,
      value: s.id,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a Skill to run',
      matchOnDetail: true,
      matchOnDescription: true,
    });

    if (!picked) return;
    skillId = picked.value;
  }

  const skill = ALL_SKILLS.find((s) => s.id === skillId);
  if (!skill) {
    vscode.window.showErrorMessage(`Ethan: Skill "${skillId}" not found.`);
    return;
  }

  const userContext = await vscode.window.showInputBox({
    prompt: `Provide context for "${skill.name}" (optional)`,
    placeHolder: 'e.g. 用户登录功能需求分析',
  });

  // Build a prompt string combining skill metadata + user context
  const lines: string[] = [
    `# Ethan Skill: ${skill.name}`,
    '',
    `> ${skill.detailDescription}`,
    '',
  ];

  if (userContext && userContext.trim().length > 0) {
    lines.push(`**Context**: ${userContext.trim()}`, '');
  }

  lines.push('## Steps', '');
  for (const step of skill.steps) {
    lines.push(`### ${step.title}`, '', step.content, '');
  }

  lines.push(`**Output format**: ${skill.outputFormat}`);

  const prompt = lines.join('\n');

  await vscode.env.clipboard.writeText(prompt);

  vscode.window.showInformationMessage(
    `Ethan: "${skill.name}" prompt copied to clipboard. Paste it into your AI chat.`
  );
}

// ---------------------------------------------------------------------------
// Open dashboard
// ---------------------------------------------------------------------------

async function openDashboard(extensionPath: string): Promise<void> {
  // Try to start the CLI serve command (best-effort; ignore errors)
  const distCli = path.join(extensionPath, 'dist', 'cli', 'index.js');
  if (fs.existsSync(distCli)) {
    cp.spawn('node', [distCli, 'serve'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }

  await vscode.commands.executeCommand(
    'vscode.open',
    vscode.Uri.parse('http://localhost:3000')
  );
}

// ---------------------------------------------------------------------------
// registerCommands (public entry point)
// ---------------------------------------------------------------------------

export interface RegisterCommandsResult {
  skillsProvider: SkillTreeDataProvider;
  pipelinesProvider: PipelineTreeDataProvider;
  statusBarItem: vscode.StatusBarItem;
}

/**
 * Registers all Ethan commands and creates the sidebar providers and status bar item.
 * Returns the providers so `extension.ts` can wire them up to tree views.
 */
export function registerCommands(
  context: vscode.ExtensionContext
): RegisterCommandsResult {
  // Capture extension path for use in closure-based command functions
  setExtensionPath(context.extensionPath);

  // Tree data providers
  const skillsProvider = new SkillTreeDataProvider();
  const pipelinesProvider = new PipelineTreeDataProvider();

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(wand) Ethan';
  statusBarItem.tooltip = 'Ethan: Click to run a Skill';
  statusBarItem.command = 'ethan.runSkill';
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,

    vscode.commands.registerCommand('ethan.install', installRules),

    vscode.commands.registerCommand('ethan.listSkills', listSkills),

    vscode.commands.registerCommand(
      'ethan.runSkill',
      (preselectedId?: string) => runSkill(preselectedId)
    ),

    vscode.commands.registerCommand('ethan.openDashboard', () =>
      openDashboard(context.extensionPath)
    ),

    vscode.commands.registerCommand('ethan.refreshSkills', () => {
      skillsProvider.refresh();
      pipelinesProvider.refresh();
      vscode.window.showInformationMessage('Ethan: Skills refreshed.');
    })
  );

  return { skillsProvider, pipelinesProvider, statusBarItem };
}
