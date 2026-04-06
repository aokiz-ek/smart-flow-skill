#!/usr/bin/env node
/**
 * npx ethan CLI
 * 命令：install | list | mcp | validate | pipeline | doctor | stats (show/leaderboard/reset) | init | run | workflow
 *       commit | review | pr | standup | changelog
 *       scan | explain | test-case | naming | readme | roast
 *       oncall | schedule (add/list/remove) | hooks (install/list/remove)
 *       memory (add/search/show/list/export/remove) | estimate | retro | pipeline-init
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { ALL_SKILLS } from '../skills/index';
import type { Platform, BuildContext } from '../skills/types';
import { checkForUpdates } from './update-check';
import { readConfig, writeConfig, getConfigPath } from './config';
import {
  isGitRepo,
  getStagedDiff,
  getBranchDiff,
  getStagedFiles,
  getCurrentBranch,
  getDefaultBranch,
  getCommitLogSince,
  getCommitRange,
  getLatestTag,
  getTags,
  truncateDiff,
} from '../git/utils';

// ─── 文件路径解析工具（兼容 Windows 正/反斜杠） ────────────────────────────
/**
 * 将用户传入的文件路径规范化后 resolve 到绝对路径。
 * 解决 Git Bash 在 Windows 上把 src\api\foo.js 里的反斜杠当转义字符吃掉的问题：
 *   - Git Bash: src\api\common\login.js → srcapicommonlogin.js （bash 已剥离，无法恢复）
 *   - CMD / PowerShell: src\api\common\login.js → 正常，path.resolve 自动处理
 * 建议用户在 Git Bash 下使用正斜杠：src/api/common/login.js
 */
function resolveFilePath(file: string): string {
  // 将路径中的反斜杠统一替换为正斜杠，再交给 path.resolve
  // （对 CMD/PowerShell 用户同样生效，保持一致）
  const normalized = file.replace(/\\/g, '/');
  return path.resolve(process.cwd(), normalized);
}

function assertFileExists(filePath: string, rawArg: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在：${filePath}`);
    // 如果路径看起来像是反斜杠被吞掉（无路径分隔符且包含典型路径词），给出提示
    if (!rawArg.includes('/') && !rawArg.includes('\\')) {
      console.error(
        `   提示：在 Git Bash 中请使用正斜杠，例如：` +
        `${rawArg.replace(/([a-z])([A-Z])/g, '$1/$2')}`
      );
      console.error(`   或者使用引号包裹路径："${rawArg}"`);
    } else {
      console.error(`   提示：Windows 路径请使用正斜杠，如 src/api/common/login.js`);
    }
    process.exit(1);
  }
}

// ─── 剪贴板工具函数（不经过 shell，避免 backtick 命令注入） ─────────────────
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'darwin') {
      spawnSync('pbcopy', [], { input: text, encoding: 'utf-8' });
      return true;
    } else if (process.platform === 'win32') {
      // clip.exe 以系统 ANSI 码页读取 stdin，UTF-8 直接传入会乱码
      // 解决方案：传入 UTF-16LE + BOM，Windows 剪贴板原生支持 UTF-16
      const bom = Buffer.from([0xff, 0xfe]);
      const utf16 = Buffer.from(text, 'utf16le');
      spawnSync('clip', [], { input: Buffer.concat([bom, utf16]), shell: false });
      return true;
    } else {
      spawnSync('xclip', ['-selection', 'clipboard'], { input: text, encoding: 'utf-8' });
      return true;
    }
  } catch {
    return false;
  }
}

// ─── 加载自定义 Skill（透明合并到 ALL_SKILLS） ───────────────────────────────
async function getActiveSkills() {
  const { loadCustomSkills } = await import('../loader/custom-skill-loader');
  const custom = loadCustomSkills(process.cwd());
  return [...ALL_SKILLS, ...custom];
}

// ─── Node.js 最低版本检查 ────────────────────────────────────────────────────
;(() => {
  const MIN_MAJOR = 18;
  const cur = process.versions.node;
  const major = parseInt(cur.split('.')[0], 10);
  if (major < MIN_MAJOR) {
    process.stderr.write(
      `\n  ╭──────────────────────────────────────────────────────╮\n` +
      `  │  ❌  Node.js 版本过低，Ethan 无法运行                  │\n` +
      `  │                                                        │\n` +
      `  │  当前版本：v${cur.padEnd(12)} 最低要求：v${MIN_MAJOR}.0.0         │\n` +
      `  │                                                        │\n` +
      `  │  升级方法：                                            │\n` +
      `  │    nvm install ${MIN_MAJOR}   # 推荐 nvm 管理版本             │\n` +
      `  │    https://nodejs.org         # 或官网下载             │\n` +
      `  ╰──────────────────────────────────────────────────────╯\n\n`
    );
    process.exit(1);
  }
})();

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

// 静默后台检查更新（不阻塞 CLI）
checkForUpdates(pkg.version, pkg.name);

const program = new Command();

program
  .name('ethan')
  .description('Ethan - Your AI Workflow Assistant')
  .version(pkg.version);

// ─── Stats 辅助函数 ──────────────────────────────────────────────────────────

const STATS_FILE = path.join(os.homedir(), '.ethan-stats.json');

function readStats(): Record<string, number> {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      return raw.usage || raw;
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

function writeStats(stats: Record<string, number>): void {
  try {
    // 合并到 v2 格式
    const existing = (() => {
      try {
        if (fs.existsSync(STATS_FILE)) {
          const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
          if (raw.usage) return raw;
        }
      } catch { /* ignore */ }
      return { usage: {}, streak: { current: 0, best: 0, lastDate: '' }, dailyLog: {} };
    })();
    existing.usage = stats;
    fs.writeFileSync(STATS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

// ─── install 命令 ───────────────────────────────────────────────────────────
program
  .command('install')
  .description('将 Ethan 规则文件安装到当前项目')
  .option(
    '-p, --platform <platform>',
    '目标平台：cursor | copilot | cline | lingma | codebuddy | windsurf | zed | jetbrains | continue | claude-code | all',
    'all'
  )
  .option('-d, --dir <dir>', '目标目录（默认为当前目录）', process.cwd())
  .option('--lang <lang>', '输出语言：zh（默认）或 en', '')
  .option('--auto-context', '自动检测项目技术栈并注入规则文件头部')
  .action(async (options) => {
    const { platform, dir } = options;

    // 语言优先级：--lang 参数 > .ethanrc.json > 默认 zh
    const config = readConfig(dir);
    const lang: 'zh' | 'en' =
      options.lang === 'en' || options.lang === 'zh'
        ? options.lang
        : config.lang ?? 'zh';

    // 自动上下文检测
    let contextPrefix = '';
    if (options.autoContext) {
      const { detectProjectContext, formatContextBlock } = await import('../context/detector');
      const projCtx = detectProjectContext(dir);
      contextPrefix = formatContextBlock(projCtx, lang);
      const detected = [
        ...projCtx.languages,
        ...projCtx.frameworks,
        ...projCtx.tools,
      ].join(', ');
      console.log(`\n🔍 检测到技术栈：${detected || '未识别，仍可注入项目名称'}`);
    }

    const rulesDir = path.join(__dirname, '../../rules');

    // platform → { 预构建文件路径, 目标路径, 对应模板 Platform 类型 }
    type InstallEntry = { src: string; dest: string; platformKey: Platform };
    const platformMap: Record<string, InstallEntry[]> = {
      cursor: [
        {
          src: path.join(rulesDir, 'cursor/smart-flow.mdc'),
          dest: path.join(dir, '.cursor/rules/smart-flow.mdc'),
          platformKey: 'cursor-new',
        },
        {
          src: path.join(rulesDir, 'cursor/.cursorrules'),
          dest: path.join(dir, '.cursorrules'),
          platformKey: 'cursor-old',
        },
      ],
      copilot: [{ src: path.join(rulesDir, 'copilot/copilot-instructions.md'), dest: path.join(dir, '.github/copilot-instructions.md'), platformKey: 'copilot' }],
      cline: [{ src: path.join(rulesDir, 'cline/.clinerules'), dest: path.join(dir, '.clinerules'), platformKey: 'cline' }],
      lingma: [{ src: path.join(rulesDir, 'lingma/smart-flow.md'), dest: path.join(dir, '.lingma/rules/smart-flow.md'), platformKey: 'lingma' }],
      codebuddy: [{ src: path.join(rulesDir, 'codebuddy/CODEBUDDY.md'), dest: path.join(dir, 'CODEBUDDY.md'), platformKey: 'codebuddy' }],
      windsurf: [{ src: path.join(rulesDir, 'windsurf/.windsurf/rules/smart-flow.md'), dest: path.join(dir, '.windsurf/rules/smart-flow.md'), platformKey: 'windsurf' }],
      zed: [{ src: path.join(rulesDir, 'zed/smart-flow.rules'), dest: path.join(dir, 'smart-flow.rules'), platformKey: 'zed' }],
      jetbrains: [{ src: path.join(rulesDir, 'jetbrains/smart-flow.md'), dest: path.join(dir, '.github/ai-instructions.md'), platformKey: 'jetbrains' }],
      continue: [{ src: path.join(rulesDir, 'continue/.continuerules'), dest: path.join(dir, '.continuerules'), platformKey: 'continue' }],
      'claude-code': [{ src: path.join(rulesDir, 'claude-code/CLAUDE.md'), dest: path.join(dir, 'CLAUDE.md'), platformKey: 'claude-code' }],
    };

    const targets =
      platform === 'all'
        ? Object.values(platformMap).flat()
        : platformMap[platform] ?? [];

    if (targets.length === 0) {
      console.error(`Unknown platform: ${platform}`);
      console.error(
        `Available: cursor | copilot | cline | lingma | codebuddy | windsurf | zed | jetbrains | continue | claude-code | all`
      );
      process.exit(1);
    }

    // 英文模式：按需渲染模板写入，无需预构建文件
    if (lang === 'en') {
      const { renderMarkdown } = await import('../templates/copilot-md.template');
      const { renderCursorMdc, renderCursorOld } = await import('../templates/cursor-mdc.template');
      const now = new Date().toISOString();
      let installed = 0;
      for (const { dest, platformKey } of targets) {
        const makeCtx = (): BuildContext => ({
          platform: platformKey,
          skills: ALL_SKILLS,
          generatedAt: now,
          version: pkg.version,
          lang: 'en',
        });
        let content: string;
        if (platformKey === 'cursor-new') content = renderCursorMdc(makeCtx());
        else if (platformKey === 'cursor-old') content = renderCursorOld(makeCtx());
        else content = renderMarkdown(makeCtx());
        if (contextPrefix) content = contextPrefix + content;
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(dest, content, 'utf-8');
        console.log(`  ✅  ${path.relative(dir, dest)} [en]`);
        installed++;
      }
      console.log(`\nInstalled ${installed} rule file(s) to ${dir} (lang: en)`);
      if (installed > 0) console.log('Restart your AI editor to apply the new rules.');
      return;
    }

    let installed = 0;
    for (const { src, dest } of targets) {
      if (!fs.existsSync(src)) {
        console.warn(`  ⚠️  Source not found: ${src} (run 'npm run build:rules' first)`);
        continue;
      }
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      // auto-context 模式：读取内容并注入上下文前缀
      if (contextPrefix) {
        const content = fs.readFileSync(src, 'utf-8');
        fs.writeFileSync(dest, contextPrefix + content, 'utf-8');
      } else {
        fs.copyFileSync(src, dest);
      }
      console.log(`  ✅  ${path.relative(dir, dest)}`);
      installed++;
    }

    console.log(`\nInstalled ${installed} rule file(s) to ${dir}`);
    if (installed > 0) {
      console.log('Restart your AI editor to apply the new rules.');
    }
  });

// ─── slash 命令 ──────────────────────────────────────────────────────────────

/** 工作流 Slash 命令定义（不依赖 SkillDefinition，直接内联） */
const WORKFLOW_SLASH_COMMANDS = [
  // ── Git 集成 ──────────────────────────────────────────────
  {
    id: 'commit',
    name: 'Git Commit',
    category: 'Git 集成',
    description: '读取 staged diff，生成符合 Conventional Commits 规范的提交信息',
    prompt:
      `# Ethan — Git Commit\n\n` +
      `请分析当前暂存区（staged）的 Git 变更，按照 **Conventional Commits** 规范生成提交信息。\n\n` +
      `格式：\`type(scope): subject\`\n\n` +
      `type 枚举：feat | fix | docs | style | refactor | perf | test | chore | ci | revert\n\n` +
      `要求：\n- subject 不超过 72 字符，使用动词开头（小写）\n` +
      `- 有破坏性变更时附加 BREAKING CHANGE footer\n` +
      `- 如有必要，提供 body 说明"为什么"而非"做了什么"\n\n` +
      `如果终端可用，也可直接运行：\`ethan commit\``,
  },
  {
    id: 'review',
    name: 'Code Review',
    category: 'Git 集成',
    description: '读取分支 diff，输出 Blocker/Major/Minor 分级审查报告',
    prompt:
      `# Ethan — Code Review\n\n` +
      `请对当前分支与主干的差异执行系统性代码审查，按严重程度分级输出：\n\n` +
      `- 🔴 **Blocker**：必须修复，阻塞合入\n` +
      `- 🟠 **Major**：重要问题，强烈建议修复\n` +
      `- 🟡 **Minor**：轻微问题，建议优化\n` +
      `- 💚 **Praise**：值得肯定的写法\n\n` +
      `审查维度：正确性、安全性、性能、可读性、测试覆盖率、边界条件\n\n` +
      `如果终端可用，也可直接运行：\`ethan review\``,
  },
  {
    id: 'pr',
    name: 'PR 描述生成',
    category: 'Git 集成',
    description: '生成结构化 PR 标题 + 正文 + Checklist',
    prompt:
      `# Ethan — PR 描述生成\n\n` +
      `请根据本次变更内容生成一份完整的 Pull Request 描述，包含：\n\n` +
      `## 结构\n` +
      `- **标题**：\`type: 简洁描述（不超过 72 字符）\`\n` +
      `- **Summary**：1-3 句话说明改了什么、为什么改\n` +
      `- **变更列表**：bullet 形式的具体变更点\n` +
      `- **测试方案**：如何验证本次改动\n` +
      `- **Checklist**：[ ] 自测通过 [ ] 无破坏性变更 [ ] 文档已更新\n\n` +
      `如果终端可用，也可直接运行：\`ethan pr\``,
  },
  {
    id: 'standup',
    name: '站会发言稿',
    category: 'Git 集成',
    description: '根据近期提交历史生成站会发言稿',
    prompt:
      `# Ethan — 站会发言稿\n\n` +
      `请根据近期 Git 提交记录生成简洁的每日站会发言，格式：\n\n` +
      `**昨天完成**：（基于实际提交）\n` +
      `**今天计划**：（基于待处理事项）\n` +
      `**阻塞风险**：（如有）\n\n` +
      `发言控制在 3 分钟以内，突出业务价值而非技术细节。\n\n` +
      `如果终端可用，也可直接运行：\`ethan standup\``,
  },
  {
    id: 'changelog',
    name: 'CHANGELOG 生成',
    category: 'Git 集成',
    description: '生成两个版本标签之间的 CHANGELOG',
    prompt:
      `# Ethan — CHANGELOG 生成\n\n` +
      `请根据提交历史按 [Keep a Changelog](https://keepachangelog.com) 规范生成 CHANGELOG，分组：\n\n` +
      `### Added | Changed | Deprecated | Removed | Fixed | Security\n\n` +
      `每条变更简洁描述，关联 commit hash，破坏性变更加 ⚠️ 标记。\n\n` +
      `如果终端可用，也可直接运行：\`ethan changelog\``,
  },
  // ── 有状态工作流 ────────────────────────────────────────────
  {
    id: 'workflow-start',
    name: '启动工作流',
    category: '有状态工作流',
    description: '启动指定 Pipeline 的有状态工作流会话',
    prompt:
      `# Ethan — 启动工作流\n\n` +
      `我需要启动一个 Ethan 有状态工作流会话。请告诉我：\n\n` +
      `1. 选择 Pipeline：dev-workflow | reporting | quality-workflow | full-dev-cycle | incident-response | new-feature | spec-workflow\n` +
      `2. 描述任务上下文（如"实现用户登录功能"）\n\n` +
      `启动后，逐步执行每个 Skill 步骤，完成后用 \`ethan workflow done\` 推进。\n\n` +
      `CLI 用法：\`ethan workflow start <pipeline> -c "任务描述"\``,
  },
  {
    id: 'workflow-done',
    name: '完成当前步骤',
    category: '有状态工作流',
    description: '记录本步摘要并推进工作流到下一步',
    prompt:
      `# Ethan — 完成当前工作流步骤\n\n` +
      `请帮我总结本步骤的执行结果，并推进到下一步：\n\n` +
      `1. 用 2-3 句话总结本步完成了什么\n` +
      `2. 列出关键产出物或决策\n` +
      `3. 标注任何阻塞或风险\n\n` +
      `然后展示下一步的 Skill 提示词。\n\n` +
      `CLI 用法：\`ethan workflow done "本步摘要"\``,
  },
  {
    id: 'workflow-status',
    name: '工作流状态',
    category: '有状态工作流',
    description: '查看当前工作流进度与各步骤完成情况',
    prompt:
      `# Ethan — 工作流状态查看\n\n` +
      `请展示当前工作流的进度看板：\n\n` +
      `- 当前 Pipeline 与总步数\n` +
      `- 已完成步骤（✅）与待执行步骤（⬜）\n` +
      `- 当前步骤名称与简短说明\n` +
      `- 预计剩余步骤\n\n` +
      `CLI 用法：\`ethan workflow status\``,
  },
  // ── Auto-Pilot ──────────────────────────────────────────────
  {
    id: 'auto',
    name: 'Auto-Pilot 超级 Prompt',
    category: 'Auto-Pilot',
    description: '生成一键链式执行完整 Pipeline 的超级 prompt',
    prompt:
      `# Ethan — Auto-Pilot\n\n` +
      `请为我生成一个 Auto-Pilot 超级 prompt，让 AI 自动链式执行完整 Pipeline，无需每步手动推进。\n\n` +
      `选择要执行的 Pipeline：\n` +
      `- \`dev-workflow\`：需求理解 → 任务拆解 → 方案设计 → 执行实现\n` +
      `- \`full-dev-cycle\`：需求 → 接口设计 → 方案 → 实现 → 审查 → 部署\n` +
      `- \`new-feature\`：PRD → 技术调研 → 接口设计 → 任务拆解 → 实现\n` +
      `- \`quality-workflow\`：代码审查 → 故障排查\n` +
      `- \`reporting\`：进度跟踪 → 任务报告 → 周报生成\n` +
      `- \`incident-response\`：故障排查 → 技术调研 → 任务报告\n\n` +
      `描述你的任务上下文，我将生成完整的超级 prompt。\n\n` +
      `CLI 用法：\`ethan auto <pipeline> -c "任务描述"\``,
  },
  // ── 开发工具 ────────────────────────────────────────────────
  {
    id: 'explain',
    name: '代码解释',
    category: '开发工具',
    description: '多层次解释代码逻辑（junior/senior/principal 视角）',
    prompt:
      `# Ethan — 代码解释\n\n` +
      `请从以下视角解释指定代码：\n\n` +
      `- **Junior**：逐行讲解，说明每个概念\n` +
      `- **Senior**：聚焦设计决策和权衡取舍\n` +
      `- **Principal**：架构影响、扩展性、潜在风险\n\n` +
      `请提供要解释的代码片段，并指定希望的解释深度。\n\n` +
      `CLI 用法：\`ethan explain [file] --level junior|senior|principal\``,
  },
  {
    id: 'test-case',
    name: '测试用例生成',
    category: '开发工具',
    description: '为指定函数/模块生成完整单元测试提示词',
    prompt:
      `# Ethan — 测试用例生成\n\n` +
      `请为指定代码生成完整的单元测试，遵循 AAA 模式（Arrange-Act-Assert）：\n\n` +
      `- 正向用例：正常输入的预期结果\n` +
      `- 边界用例：空值、极值、边界条件\n` +
      `- 异常用例：非法输入、异常抛出\n` +
      `- Mock 策略：外部依赖如何 mock\n\n` +
      `框架：Vitest / Jest（默认 Vitest）\n\n` +
      `CLI 用法：\`ethan test-case <file> --framework vitest\``,
  },
  {
    id: 'estimate',
    name: '任务估算',
    category: '开发工具',
    description: '三点估算（乐观/悲观/最可能）+ T-shirt Size',
    prompt:
      `# Ethan — 任务估算\n\n` +
      `请对当前任务进行三点估算：\n\n` +
      `| 估算维度 | 说明 |\n` +
      `|---------|------|\n` +
      `| 乐观估算 (O) | 一切顺利时的最短时间 |\n` +
      `| 悲观估算 (P) | 遇到阻碍时的最长时间 |\n` +
      `| 最可能 (M) | 最现实的估算 |\n` +
      `| 期望值 E | (O + 4M + P) / 6 |\n\n` +
      `同时给出 T-shirt Size（XS/S/M/L/XL）和主要风险点。\n\n` +
      `CLI 用法：\`ethan estimate --style hours|story-points|days\``,
  },
  // ── OpenSpec 集成 ────────────────────────────────────────────
  {
    id: 'spec-proposal',
    name: 'Spec 变更提案',
    category: 'OpenSpec',
    description: '在编码前生成完整 OpenSpec 变更提案包（proposal + design + tasks + spec delta）',
    prompt:
      `# Ethan — Spec Proposal\n\n` +
      `请基于 OpenSpec 规范，为本次变更生成完整提案包。在开始编码之前，先对齐需求意图和实现范围。\n\n` +
      `**请提供**：\n` +
      `1. 变更描述（做什么、为什么）\n` +
      `2. 涉及的功能模块（capability）\n\n` +
      `**将生成文件**：\n` +
      `- \`openspec/changes/[id]/proposal.md\`（变更提案）\n` +
      `- \`openspec/changes/[id]/design.md\`（技术方案）\n` +
      `- \`openspec/changes/[id]/tasks.md\`（分阶段任务）\n` +
      `- \`openspec/changes/[id]/specs/[capability].md\`（spec delta）\n\n` +
      `原则：**Review intent, not just code**\n\n` +
      `CLI 用法：\`ethan spec proposal <capability> -c "变更描述"\``,
  },
  {
    id: 'spec-review',
    name: 'Spec 意图审查',
    category: 'OpenSpec',
    description: '对比 spec delta 与代码实现，执行意图级 Review，输出对齐矩阵和偏差报告',
    prompt:
      `# Ethan — Spec Review（意图审查）\n\n` +
      `请执行意图级 Spec Review，对照 openspec/changes/ 中的 spec delta 与代码变更：\n\n` +
      `**审查维度**：\n` +
      `1. 🗺️ **意图对齐矩阵**：每个 spec 需求/场景 → 对应代码位置 → ✅/⚠️/❌\n` +
      `2. 🔴 **意图偏差（Critical）**：实现与 spec 意图相反或严重不符\n` +
      `3. 🟡 **遗漏需求（Warning）**：spec 中有但代码未实现的场景\n` +
      `4. 💡 **超范围实现（Info）**：代码实现了 spec 未定义的功能\n\n` +
      `请先读取 openspec/changes/ 中最新的变更提案，再对照代码变更执行审查。\n\n` +
      `CLI 用法：\`ethan spec review\``,
  },
  {
    id: 'spec-validate',
    name: 'Spec 规范校验',
    category: 'OpenSpec',
    description: '校验 openspec/ 目录结构完整性：Requirements 编号、GIVEN/WHEN/THEN 格式',
    prompt:
      `# Ethan — Spec Validate\n\n` +
      `请校验项目 openspec/ 目录的规范完整性，检查：\n\n` +
      `- 每个 capability 是否包含 Purpose / Requirements / Scenarios 章节\n` +
      `- Requirements 编号是否连续（REQ-001, REQ-002...）\n` +
      `- Scenario 是否使用完整的 GIVEN/WHEN/THEN 格式\n` +
      `- 是否存在空内容的占位模板\n\n` +
      `输出：问题列表（按严重程度分级）+ 合格/不合格摘要\n\n` +
      `CLI 用法：\`ethan spec validate [capability]\``,
  },
  // ── 分析工具 ─────────────────────────────────────────────────
  {
    id: 'dora',
    name: 'DORA 指标分析',
    category: '分析工具',
    description: '基于 git 历史统计 DORA 四键指标（部署频率/变更前置时间/故障率/恢复时间）',
    prompt:
      `# Ethan — DORA 四键指标\n\n` +
      `请基于 git 历史分析团队的 DORA 四键指标：\n\n` +
      `1. **Deployment Frequency（部署频率）**：多久发布一次\n` +
      `2. **Lead Time for Changes（变更前置时间）**：代码从提交到上线耗时\n` +
      `3. **Change Failure Rate（变更失败率）**：hotfix/revert 占比\n` +
      `4. **Time to Restore（恢复时间）**：故障修复平均耗时\n\n` +
      `分级：Elite / High / Medium / Low\n\n` +
      `CLI 用法：\`ethan dora --since 30\``,
  },
  {
    id: 'diff',
    name: '变更风险分析',
    category: '分析工具',
    description: '读取 git diff，分析变更影响面与风险等级',
    prompt:
      `# Ethan — 变更风险分析\n\n` +
      `请分析当前 git diff 的变更风险：\n\n` +
      `- **影响面**：涉及的模块/服务/接口\n` +
      `- **风险等级**：🔴 高 / 🟡 中 / 🟢 低（附理由）\n` +
      `- **高风险点**：需要重点测试的代码路径\n` +
      `- **建议**：回滚方案、监控指标、测试 Checklist\n\n` +
      `CLI 用法：\`ethan diff [base] [head]\``,
  },
  {
    id: 'deps',
    name: '依赖健康检查',
    category: '分析工具',
    description: '扫描 package.json，生成依赖过期、漏洞和升级建议报告',
    prompt:
      `# Ethan — 依赖健康检查\n\n` +
      `请分析项目依赖的健康状态：\n\n` +
      `1. **过期依赖**：主版本落后 2+ 个版本的包\n` +
      `2. **安全漏洞**：High/Critical CVE（npm audit 结果）\n` +
      `3. **升级建议**：按优先级排列，附 breaking change 风险\n` +
      `4. **废弃 API**：使用了 deprecated API 的直接依赖\n\n` +
      `输出：依赖健康评分 + 行动计划\n\n` +
      `CLI 用法：\`ethan deps [--fix]\``,
  },
  {
    id: 'mermaid',
    name: 'Mermaid 图表生成',
    category: '分析工具',
    description: '根据描述生成 Mermaid 流程图/时序图/ER 图/架构图',
    prompt:
      `# Ethan — Mermaid 图表生成\n\n` +
      `请根据我的描述生成 Mermaid 图表代码：\n\n` +
      `**支持类型**：\n` +
      `- \`flowchart\`：业务流程图、决策树\n` +
      `- \`sequence\`：API 调用时序图\n` +
      `- \`er\`：数据库 ER 图\n` +
      `- \`architecture\`：系统架构图\n` +
      `- \`gantt\`：项目甘特图\n\n` +
      `请描述要绘制的内容，并指定图表类型。\n\n` +
      `CLI 用法：\`ethan mermaid --type sequence --desc "描述"\``,
  },
  {
    id: 'migrate',
    name: '框架迁移助手',
    category: '分析工具',
    description: '生成从旧框架/工具迁移到新版本的分步迁移方案',
    prompt:
      `# Ethan — 框架迁移助手\n\n` +
      `请生成框架/工具迁移方案，包含：\n\n` +
      `1. **迁移前提**：前置条件与兼容性检查\n` +
      `2. **迁移步骤**：分阶段、可回滚的操作序列\n` +
      `3. **代码变更模式**：Before/After 对照示例\n` +
      `4. **常见陷阱**：迁移过程中的已知问题\n` +
      `5. **验证方案**：每步完成后的检验方法\n\n` +
      `请告知迁移来源和目标（如 CRA → Vite，Webpack 4 → 5，Jest → Vitest）\n\n` +
      `CLI 用法：\`ethan migrate --from cra --to vite\``,
  },
  {
    id: 'postmortem',
    name: '故障复盘报告',
    category: '分析工具',
    description: '根据事故信息生成结构化的 Postmortem 报告',
    prompt:
      `# Ethan — 故障复盘（Postmortem）\n\n` +
      `请生成标准化的故障复盘报告，格式遵循 Google SRE 最佳实践：\n\n` +
      `## 报告结构\n` +
      `- **事故摘要**：时间线、影响范围、严重程度\n` +
      `- **根因分析**（5 Why）\n` +
      `- **贡献因素**（技术、流程、人员）\n` +
      `- **时间线**：详细事件序列\n` +
      `- **后续行动**：P0/P1/P2 改进项（附责任人和截止日期）\n` +
      `- **经验教训**\n\n` +
      `请描述事故经过，我来整理成规范报告。\n\n` +
      `CLI 用法：\`ethan postmortem --incident INC-001\``,
  },
] as const;

program
  .command('slash')
  .alias('slash-install')
  .description('为各平台生成专属 Slash 命令文件（Skills + 工作流指令，Claude Code 原生 /ethan-xxx、其他平台速查表）')
  .option(
    '-p, --platform <platform>',
    '目标平台：claude-code | cursor | codebuddy | copilot | cline | windsurf | zed | jetbrains | continue | lingma | all',
    'all'
  )
  .option('-d, --dir <dir>', '目标目录（默认为当前目录）', process.cwd())
  .action(async (options: { platform: string; dir: string }) => {
    const { platform, dir } = options;
    const skills = await getActiveSkills();

    // 支持的平台列表
    const ALL_PLATFORMS = [
      'claude-code', 'cursor', 'codebuddy', 'copilot', 'cline',
      'windsurf', 'zed', 'jetbrains', 'continue', 'lingma',
    ];
    const targets = platform === 'all' ? ALL_PLATFORMS : [platform];
    if (!ALL_PLATFORMS.includes(targets[0])) {
      console.error(`Unknown platform: ${platform}`);
      console.error(`Available: ${ALL_PLATFORMS.join(' | ')} | all`);
      process.exit(1);
    }

    // 各平台默认安装目录
    const platformDirMap: Record<string, string> = {
      'claude-code': path.join(dir, '.claude/commands'),
      codebuddy:     path.join(dir, '.codebuddy/commands'),
      cursor:        path.join(dir, '.cursor/rules'),
      copilot:       path.join(dir, '.github'),
      cline:         dir,
      windsurf:      path.join(dir, '.windsurf/rules'),
      zed:           dir,
      jetbrains:     path.join(dir, '.github'),
      continue:      dir,
      lingma:        path.join(dir, '.lingma/rules'),
    };

    let total = 0;

    for (const p of targets) {
      const outDir = platformDirMap[p];
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      if (p === 'claude-code' || p === 'codebuddy') {
        const isClaudeCode = p === 'claude-code';
        const cmdDir = isClaudeCode ? '.claude/commands' : '.codebuddy/commands';

        // ── 每个 Skill 生成独立 .md slash 命令文件 ──────────────────────────────
        for (const skill of skills) {
          const stepsText = skill.steps
            .map((s) => `### ${s.title}\n${s.content}`)
            .join('\n\n');
          const content =
            `---\n` +
            `description: "Ethan — ${skill.name}：${skill.description.substring(0, 60)}"\n` +
            `---\n\n` +
            `# Ethan Skill：${skill.name}\n\n` +
            `${skill.detailDescription}\n\n` +
            `## 执行步骤\n\n${stepsText}\n\n` +
            `## 输出格式\n\n${skill.outputFormat}\n`;

          fs.writeFileSync(path.join(outDir, `ethan-${skill.id}.md`), content, 'utf-8');
          total++;
        }
        console.log(`  ✅  ${p.padEnd(12)} →  Skills: ${cmdDir}/ethan-{skill}.md × ${skills.length}`);

        // ── 工作流 Slash 命令 ────────────────────────────────────────────────────
        if (isClaudeCode) {
          // Claude Code：动态注入（$(!ethan ... --no-copy)）
          // CLI 调用映射（$ARGUMENTS 会被替换为用户输入的参数）
          const CLI_INVOCATIONS: Record<string, string> = {
            'commit':          'ethan commit --no-copy $ARGUMENTS',
            'review':          'ethan review --no-copy $ARGUMENTS',
            'pr':              'ethan pr --no-copy $ARGUMENTS',
            'standup':         'ethan standup --no-copy $ARGUMENTS',
            'changelog':       'ethan changelog --no-copy $ARGUMENTS',
            'workflow-start':  'ethan workflow start $ARGUMENTS',
            'workflow-done':   'ethan workflow done $ARGUMENTS',
            'workflow-status': 'ethan workflow status',
            'auto':            'ethan auto $ARGUMENTS --no-copy',
            'explain':         'ethan explain $ARGUMENTS --no-copy',
            'test-case':       'ethan test-case $ARGUMENTS --no-copy',
            'estimate':        'ethan estimate --no-copy $ARGUMENTS',
            'spec-proposal':   'ethan spec proposal --no-copy $ARGUMENTS',
            'spec-review':     'ethan spec review --no-copy',
            'spec-validate':   'ethan spec validate --no-copy $ARGUMENTS',
            'dora':            'ethan dora --no-copy $ARGUMENTS',
            'diff':            'ethan diff --no-copy $ARGUMENTS',
            'deps':            'ethan deps --no-copy',
            'postmortem':      'ethan postmortem --no-copy $ARGUMENTS',
            'mermaid':         'ethan mermaid --no-copy $ARGUMENTS',
            'migrate':         'ethan migrate --no-copy $ARGUMENTS',
          };

          // 需要参数的命令：无参调用时显示用法说明（printf 内 \n 为换行）
          const PIPELINE_LIST =
            'dev-workflow: 需求理解->拆解->设计->实现\\n' +
            '- full-dev-cycle: 需求->接口->方案->实现->审查->部署\\n' +
            '- new-feature: PRD->技术调研->接口->拆解->实现\\n' +
            '- quality-workflow: 代码审查->故障排查\\n' +
            '- reporting: 进度跟踪->任务报告->周报\\n' +
            '- incident-response: 故障排查->技术调研->任务报告\\n' +
            '- spec-workflow: Spec提案->方案设计->任务拆解->实现->意图审查\\n' +
            '- bugfix-workflow: 故障排查->变更提案->实现->单元测试->意图审查\\n' +
            '- security-audit-workflow: 威胁建模->安全审查->变更提案->实现->意图审查\\n' +
            '- open-source-release: 技术调研->代码审查->单元测试->部署上线';

          const SLASH_USAGE_FALLBACKS: Record<string, string> = {
            'auto':
              '## Ethan Auto-Pilot — 缺少参数\\n\\n' +
              '用法: /ethan-auto <pipeline> [-c 任务描述]\\n\\n' +
              '可用 Pipeline:\\n- ' + PIPELINE_LIST,
            'workflow-start':
              '## Ethan 启动工作流 — 缺少参数\\n\\n' +
              '用法: /ethan-workflow-start <pipeline> -c 任务描述\\n\\n' +
              '可用 Pipeline:\\n- ' + PIPELINE_LIST,
            'workflow-done':
              '## Ethan 完成工作流步骤 — 缺少参数\\n\\n' +
              '用法: /ethan-workflow-done 本步完成了什么（2-3句话摘要）',
            'explain':
              '## Ethan 代码解释 — 缺少参数\\n\\n' +
              '用法: /ethan-explain <文件路径> [--level junior|senior|principal]\\n\\n' +
              '示例: /ethan-explain src/auth.ts --level senior',
            'test-case':
              '## Ethan 测试用例 — 缺少参数\\n\\n' +
              '用法: /ethan-test-case <文件路径> [--framework vitest|jest]\\n\\n' +
              '示例: /ethan-test-case src/utils.ts --framework vitest',
            'dora':
              '## Ethan DORA — 用法\\n\\n' +
              '/ethan-dora [--since 30]\\n\\n' +
              '统计最近 N 天的 DORA 四键指标（部署频率/前置时间/恢复时间/变更失败率）',
            'diff':
              '## Ethan Diff — 用法\\n\\n' +
              '/ethan-diff [base] [head]\\n\\n' +
              '分析 git diff 变更风险，输出变更摘要与潜在影响',
            'mermaid':
              '## Ethan Mermaid — 用法\\n\\n' +
              '/ethan-mermaid --type <sequence|flowchart|er|gantt> --desc "图表描述"\\n\\n' +
              '生成 Mermaid 图表提示词',
            'migrate':
              '## Ethan Migrate — 用法\\n\\n' +
              '/ethan-migrate --from <来源> --to <目标>\\n\\n' +
              '示例: /ethan-migrate --from cra --to vite',
          };

          for (const cmd of WORKFLOW_SLASH_COMMANDS) {
            const invocation = CLI_INVOCATIONS[cmd.id];
            const fallback = SLASH_USAGE_FALLBACKS[cmd.id];

            let body: string;
            if (invocation && fallback) {
              // 有参数要求的命令：无参时显示用法说明，有参时动态执行
              body = `$(![ -n "$ARGUMENTS" ] && ${invocation} 2>/dev/null || printf "${fallback}")\n`;
            } else if (invocation) {
              // 无参数要求的命令：直接动态执行
              body = `$(!${invocation} 2>/dev/null)\n`;
            } else {
              body = `${cmd.prompt}\n`;
            }

            const content =
              `---\n` +
              `description: "Ethan — ${cmd.name}：${cmd.description}"\n` +
              `---\n\n` +
              body;
            fs.writeFileSync(path.join(outDir, `ethan-${cmd.id}.md`), content, 'utf-8');
            total++;
          }
          console.log(`  ✅  claude-code  →  工作流: ${cmdDir}/ethan-{cmd}.md × ${WORKFLOW_SLASH_COMMANDS.length}`);
          console.log(`       使用方式：在 Claude Code 聊天中输入 /ethan-commit、/ethan-auto 等`);
          console.log(`       ⚡ 动态注入：提示词自动注入对话，无需复制粘贴`);
        } else {
          // CodeBuddy：静态提示词（各 /ethan-xxx 命令文件）
          for (const cmd of WORKFLOW_SLASH_COMMANDS) {
            const content =
              `---\n` +
              `description: "Ethan — ${cmd.name}：${cmd.description}"\n` +
              `---\n\n` +
              `${cmd.prompt}\n`;
            fs.writeFileSync(path.join(outDir, `ethan-${cmd.id}.md`), content, 'utf-8');
            total++;
          }
          console.log(`  ✅  codebuddy    →  工作流: ${cmdDir}/ethan-{cmd}.md × ${WORKFLOW_SLASH_COMMANDS.length}`);
          console.log(`       使用方式：在 CodeBuddy 聊天中输入 /ethan-commit、/ethan-auto 等`);
        }

      } else {
        // ── 其他平台：生成统一的 ethan-commands.md 速查表（Skills + 工作流）──
        const skillRows = skills
          .map((s) => `| \`/ethan-${s.id}\` | \`@ethan ${s.id}\` | ${s.name} | Skill | ${s.description} |`)
          .join('\n');

        // 按分类分组工作流命令
        const wfByCategory = WORKFLOW_SLASH_COMMANDS.reduce<Record<string, typeof WORKFLOW_SLASH_COMMANDS[number][]>>(
          (acc, cmd) => {
            (acc[cmd.category] ??= []).push(cmd);
            return acc;
          },
          {}
        );
        const wfSections = Object.entries(wfByCategory)
          .map(([cat, cmds]) => {
            const rows = cmds
              .map((c) => `| \`/ethan-${c.id}\` | \`@ethan ${c.id}\` | ${c.name} | 工作流 | ${c.description} |`)
              .join('\n');
            return `### ${cat}\n\n| Slash 命令 | @ethan 形式 | 名称 | 类型 | 说明 |\n|-----------|------------|------|------|------|\n${rows}`;
          })
          .join('\n\n');

        const platformLabel: Record<string, string> = {
          cursor:    'Cursor（在 Composer 中输入）',
          codebuddy: 'CodeBuddy（/命令触发）',
          copilot:   'GitHub Copilot（@workspace 触发）',
          cline:     'Cline（AI 对话中触发）',
          windsurf:  'Windsurf（AI Chat 中输入）',
          zed:       'Zed（AI 助手中输入）',
          jetbrains: 'JetBrains AI（AI Chat 触发）',
          continue:  'Continue（@ethan 触发）',
          lingma:    '灵码（@ethan 触发）',
        };

        const content =
          `# Ethan Slash 命令速查表 — ${platformLabel[p] ?? p}\n\n` +
          `> 生成时间：${new Date().toISOString()}\n\n` +
          `## Skills 命令（24 个）\n\n` +
          `| Slash 命令 | @ethan 形式 | Skill 名称 | 类型 | 说明 |\n` +
          `|-----------|------------|-----------|------|------|\n` +
          `${skillRows}\n\n` +
          `## 工作流命令\n\n` +
          `${wfSections}\n\n` +
          `## 快速示例\n\n` +
          `\`\`\`\n` +
          `/ethan-code-review      # Skill：代码审查\n` +
          `/ethan-git-workflow     # Skill：Git 工作流\n` +
          `/ethan-commit           # 工作流：生成提交信息\n` +
          `/ethan-review           # 工作流：Code Review\n` +
          `/ethan-auto             # 工作流：Auto-Pilot 超级 Prompt\n` +
          `/ethan-workflow-start   # 工作流：启动有状态工作流\n` +
          `\`\`\`\n`;

        const destFile = path.join(outDir, 'ethan-commands.md');
        fs.writeFileSync(destFile, content, 'utf-8');
        console.log(`  ✅  ${p.padEnd(12)} →  ${path.relative(dir, destFile)}`);
        total++;
      }
    }

    const totalFiles = (platform === 'claude-code' || platform === 'codebuddy')
      ? skills.length + WORKFLOW_SLASH_COMMANDS.length
      : total;
    console.log(`\n共生成 ${totalFiles} 个 Slash 命令文件（目录：${dir}）`);
    console.log(`  Skills: ${skills.length} 个 | 工作流: ${WORKFLOW_SLASH_COMMANDS.length} 个`);
    console.log('重启 AI 编辑器后，slash 命令即可生效。');
  });

// ─── list 命令 ──────────────────────────────────────────────────────────────
program
  .command('list')
  .description('列出所有可用 Skill（含自定义 Skill）')
  .option('--json', '以 JSON 格式输出')
  .action(async (options) => {
    const skills = await getActiveSkills();
    const customCount = skills.length - ALL_SKILLS.length;

    if (options.json) {
      console.log(
        JSON.stringify(
          skills.map((s) => ({
            id: s.id,
            name: s.name,
            nameEn: s.nameEn,
            description: s.description,
            triggers: s.triggers,
            category: s.category,
            nextSkill: s.nextSkill,
          })),
          null,
          2
        )
      );
      return;
    }

    console.log('\nEthan Skills\n');
    console.log('─'.repeat(60));
    for (const skill of skills) {
      const categoryTag = skill.category ? ` [${skill.category}]` : '';
      const customTag = skill.order >= 100 ? ' 🔧' : '';
      console.log(`\n${skill.order}. ${skill.name} (${skill.id})${categoryTag}${customTag}`);
      console.log(`   ${skill.description}`);
      console.log(`   Triggers: ${skill.triggers.slice(0, 3).join(' | ')}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${skills.length} skills (${ALL_SKILLS.length} built-in${customCount > 0 ? `, ${customCount} custom` : ''})`);
  });

// ─── skill 子命令（自定义 Skill 管理） ──────────────────────────────────────
const skillCmd = program.command('skill').description('自定义 Skill 管理');

skillCmd
  .command('new [name]')
  .description('在 .ethan/skills/ 目录生成自定义 Skill 模板')
  .option('--format <format>', '文件格式：yaml 或 md（默认 yaml）', 'yaml')
  .action(async (name?: string, options?: { format?: string }) => {
    const { generateSkillTemplate, generateMdSkillTemplate } = await import('../loader/custom-skill-loader');
    const skillsDir = path.join(process.cwd(), '.ethan/skills');
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });

    const format = options?.format === 'md' ? 'md' : 'yaml';
    const filename = name ? `${name}.${format}` : `my-skill.${format}`;
    const filePath = path.join(skillsDir, filename);

    if (fs.existsSync(filePath)) {
      console.log(`⚠️  文件已存在：${filePath}`);
      return;
    }

    const template = format === 'md' ? generateMdSkillTemplate() : generateSkillTemplate();
    fs.writeFileSync(filePath, template, 'utf-8');
    console.log(`\n✅ 已创建自定义 Skill 模板：${filePath}`);
    if (format === 'md') {
      console.log('   在 --- frontmatter 中填写元数据，在正文用 ## 标题定义步骤');
    }
    console.log('   编辑该文件后运行 ethan list 验证加载结果\n');
  });

skillCmd
  .command('list')
  .description('列出当前项目的自定义 Skill')
  .action(async () => {
    const { loadCustomSkills } = await import('../loader/custom-skill-loader');
    const custom = loadCustomSkills(process.cwd());
    if (custom.length === 0) {
      console.log('\n暂无自定义 Skill。运行 ethan skill new 创建一个。\n');
      return;
    }
    console.log(`\n🔧 自定义 Skill（${custom.length} 个）\n`);
    for (const s of custom) {
      console.log(`  ${s.name} (${s.id})`);
      console.log(`  触发词：${s.triggers.slice(0, 3).join(' | ')}`);
      console.log('');
    }
  });

// ─── plugin 命令（Skill Marketplace） ───────────────────────────────────────
const OFFICIAL_PLUGINS = [
  { name: 'ethan-plugin-deploy', description: '部署工作流 Skill（CI/CD、Docker、K8s）', author: 'community' },
  { name: 'ethan-plugin-prd', description: 'PRD 文档生成 Skill', author: 'community' },
  { name: 'ethan-plugin-api-design', description: 'RESTful/GraphQL API 设计 Skill', author: 'community' },
  { name: 'ethan-plugin-security', description: '安全审查 Skill（OWASP、依赖检查）', author: 'community' },
];

const pluginCmd = program.command('plugin').description('Skill 插件市场管理');

pluginCmd
  .command('list')
  .description('列出官方推荐插件及已安装插件')
  .action(() => {
    const config = readConfig(process.cwd());
    const installed = config.plugins ?? [];

    console.log('\n📦 Ethan 插件市场\n');
    console.log('─'.repeat(60));
    console.log('\n[官方推荐插件]\n');
    for (const p of OFFICIAL_PLUGINS) {
      const tag = installed.includes(p.name) ? ' ✅ 已安装' : '';
      console.log(`  ${p.name}${tag}`);
      console.log(`  ${p.description}\n`);
    }
    if (installed.length > 0) {
      console.log('[已安装插件]\n');
      for (const name of installed) {
        console.log(`  ${name}`);
      }
      console.log('');
    }
    console.log('─'.repeat(60));
    console.log('\n安装插件：ethan plugin install <plugin-name>');
    console.log('卸载插件：ethan plugin remove <plugin-name>\n');
  });

pluginCmd
  .command('install <name>')
  .description('从 npm 安装 Skill 插件包')
  .action(async (name: string) => {
    const { execSync } = await import('child_process');

    console.log(`\n📦 安装插件：${name}\n`);

    try {
      execSync(`npm install ${name}`, { stdio: 'inherit', cwd: process.cwd() });
    } catch {
      console.error(`\n❌ 安装失败，请确认包名正确且已发布到 npm\n`);
      process.exit(1);
    }

    // 注册到 .ethanrc.json
    const config = readConfig(process.cwd());
    const plugins = config.plugins ?? [];
    if (!plugins.includes(name)) {
      plugins.push(name);
      writeConfig({ ...config, plugins }, process.cwd());
    }

    console.log(`\n✅ 插件 ${name} 安装完成`);
    console.log(`   运行 ethan list 可查看新增 Skill\n`);
  });

pluginCmd
  .command('remove <name>')
  .description('卸载 Skill 插件包')
  .action(async (name: string) => {
    const { execSync } = await import('child_process');

    console.log(`\n🗑  卸载插件：${name}\n`);

    try {
      execSync(`npm uninstall ${name}`, { stdio: 'inherit', cwd: process.cwd() });
    } catch {
      console.warn(`  ⚠️  npm uninstall 失败，仍会从配置中移除`);
    }

    const config = readConfig(process.cwd());
    const plugins = (config.plugins ?? []).filter((p) => p !== name);
    writeConfig({ ...config, plugins }, process.cwd());

    console.log(`\n✅ 插件 ${name} 已卸载\n`);
  });

pluginCmd
  .command('publish')
  .description('将当前目录的自定义 Skill 打包并发布到 npm（Prompt OS 插件体系）')
  .option('--dry-run', '只预览，不实际发布')
  .action(async (options) => {
    const cwd = process.cwd();
    const skillsDir = path.join(cwd, '.ethan', 'skills');

    // 检查是否有自定义 Skill
    const { loadCustomSkills } = await import('../loader/custom-skill-loader');
    const customSkills = loadCustomSkills(cwd);

    if (customSkills.length === 0) {
      console.error('\n❌ 当前项目没有自定义 Skill（.ethan/skills/ 目录为空或不存在）');
      console.log('   使用 ethan skill new <name> 创建新 Skill\n');
      process.exit(1);
    }

    // 检查 package.json
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      console.error('\n❌ 当前目录没有 package.json，无法发布到 npm\n');
      process.exit(1);
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (!pkgJson.name?.startsWith('ethan-') && !pkgJson.name?.startsWith('@')) {
      console.log('\n⚠️  建议将包名设为 ethan-<your-skill-name> 格式，便于社区发现');
    }

    console.log(`\n📦 准备发布 Ethan 插件包\n`);
    console.log(`   包名：${pkgJson.name || '(未设置)'}`);
    console.log(`   版本：${pkgJson.version || '(未设置)'}`);
    console.log(`   自定义 Skill 数量：${customSkills.length}`);
    console.log(`\n   包含的 Skill：`);
    for (const s of customSkills) {
      console.log(`   - ${s.id}（${s.name}）`);
    }

    if (options.dryRun) {
      console.log('\n🔍 Dry run 模式，不实际发布。\n');
      console.log('发布清单 checklist：');
      console.log('  ✅ 确认 package.json 中有 "ethan" 关键词（便于被发现）');
      console.log('  ✅ 确认 .ethan/skills/ 目录存在且包含有效 Skill 定义');
      console.log('  ✅ 确认 README.md 描述了插件用途和安装方法');
      console.log('  ✅ 确认 main 字段指向正确的入口文件');
      console.log('\n  运行 ethan plugin publish 实际发布\n');
      return;
    }

    // 生成安装说明
    const installGuide = `\n💡 发布成功后，其他用户可通过以下命令安装：\n   ethan plugin install ${pkgJson.name}\n`;

    try {
      const { execSync } = await import('child_process');
      execSync('npm publish', { stdio: 'inherit', cwd });
      console.log(installGuide);
    } catch {
      console.error('\n❌ 发布失败，请检查 npm 登录状态（npm login）\n');
      process.exit(1);
    }
  });

pluginCmd
  .command('registry')
  .description('管理私有 Skill 插件注册表')
  .option('--set <url>', '设置私有注册表 URL')
  .option('--unset', '移除私有注册表配置')
  .option('--show', '显示当前注册表配置')
  .action((options) => {
    const config = readConfig(process.cwd());

    if (options.show || (!options.set && !options.unset)) {
      const registry = config.registry;
      console.log('\n📋 插件注册表配置');
      console.log('─'.repeat(40));
      console.log(`  公共注册表：https://registry.npmjs.org（默认）`);
      console.log(`  私有注册表：${registry || '（未配置）'}`);
      console.log('\n配置方式：');
      console.log('  ethan plugin registry --set https://your-registry.com');
      console.log('  ethan plugin registry --unset\n');
      return;
    }

    if (options.set) {
      writeConfig({ ...config, registry: options.set }, process.cwd());
      console.log(`\n✅ 私有注册表已设置为：${options.set}`);
      console.log('   后续 ethan plugin install 将优先从此注册表安装\n');
    }

    if (options.unset) {
      const { registry: _, ...rest } = config;
      writeConfig(rest, process.cwd());
      console.log('\n✅ 私有注册表配置已移除\n');
      void _;
    }
  });

pluginCmd
  .command('search <keyword>')
  .description('在 npm 上搜索 ethan- 前缀的插件包')
  .option('-n, --limit <n>', '显示条数', '10')
  .action(async (keyword, options) => {
    console.log(`\n🔍 搜索 npm 插件：${keyword}...\n`);

    try {
      const https = await import('https');
      const query = encodeURIComponent(`ethan-${keyword} keywords:ethan`);
      const limit = parseInt(options.limit, 10) || 10;

      const data = await new Promise<string>((resolve, reject) => {
        const req = https.get(
          `https://registry.npmjs.org/-/v1/search?text=${query}&size=${limit}`,
          (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => body += chunk.toString());
            res.on('end', () => resolve(body));
          }
        );
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      });

      const result = JSON.parse(data);
      const packages = result.objects || [];

      if (packages.length === 0) {
        console.log(`  未找到匹配的 ethan 插件\n`);
        return;
      }

      console.log(`找到 ${packages.length} 个插件：\n`);
      console.log('─'.repeat(60));
      for (const { package: pkg } of packages) {
        console.log(`\n  📦 ${pkg.name}  v${pkg.version}`);
        console.log(`     ${pkg.description || '无描述'}`);
        console.log(`     安装：ethan plugin install ${pkg.name}`);
      }
      console.log('\n' + '─'.repeat(60) + '\n');
    } catch (e) {
      console.error(`\n❌ 搜索失败（需要网络连接）：${(e as Error).message}\n`);
    }
  });

// ─── mcp 命令 ───────────────────────────────────────────────────────────────
program
  .command('mcp')
  .description('启动 MCP Server（stdio transport），供 AI 客户端调用')
  .action(async () => {
    try {
      const { startMcpServer } = await import('../mcp/server');
      await startMcpServer();
    } catch (err) {
      console.error('Failed to start MCP server:', err);
      process.exit(1);
    }
  });

// ─── validate 命令 ──────────────────────────────────────────────────────────
program
  .command('validate')
  .description('验证 rules/ 目录中的规则文件是否与当前 src/skills/ 同步')
  .action(async () => {
    const { renderCursorMdc, renderCursorOld } = await import('../templates/cursor-mdc.template');
    const { renderMarkdown } = await import('../templates/copilot-md.template');

    const ROOT = path.join(__dirname, '../..');
    const FIXED_TS = '1970-01-01T00:00:00.000Z';

    function makeCtx(platform: Platform): BuildContext {
      return {
        platform,
        skills: ALL_SKILLS,
        generatedAt: FIXED_TS,
        version: pkg.version,
      };
    }

    // Strip ISO timestamp lines for comparison
    const TS_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;
    function normalize(content: string): string {
      return content.replace(TS_REGEX, 'TIMESTAMP');
    }

    const checks: Array<{ file: string; expected: string }> = [
      { file: 'rules/cursor/smart-flow.mdc', expected: renderCursorMdc(makeCtx('cursor-new')) },
      { file: 'rules/cursor/.cursorrules', expected: renderCursorOld(makeCtx('cursor-old')) },
      { file: 'rules/copilot/copilot-instructions.md', expected: renderMarkdown(makeCtx('copilot')) },
      { file: 'rules/cline/.clinerules', expected: renderMarkdown(makeCtx('cline')) },
      { file: 'rules/lingma/smart-flow.md', expected: renderMarkdown(makeCtx('lingma')) },
      { file: 'rules/codebuddy/CODEBUDDY.md', expected: renderMarkdown(makeCtx('codebuddy')) },
      { file: 'rules/windsurf/.windsurf/rules/smart-flow.md', expected: renderMarkdown(makeCtx('windsurf')) },
      { file: 'rules/zed/smart-flow.rules', expected: renderMarkdown(makeCtx('zed')) },
      { file: 'rules/jetbrains/smart-flow.md', expected: renderMarkdown(makeCtx('jetbrains')) },
      { file: 'rules/continue/.continuerules', expected: renderMarkdown(makeCtx('continue')) },
      { file: 'rules/claude-code/CLAUDE.md', expected: renderMarkdown(makeCtx('claude-code')) },
    ];

    let allOk = true;
    console.log('\nValidating rules files...\n');

    for (const { file, expected } of checks) {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) {
        console.error(`  ❌  MISSING: ${file}`);
        allOk = false;
        continue;
      }

      const actual = fs.readFileSync(filePath, 'utf-8');
      const normalizedActual = normalize(actual);
      const normalizedExpected = normalize(expected);

      if (normalizedActual !== normalizedExpected) {
        const actualLines = normalizedActual.split('\n');
        const expectedLines = normalizedExpected.split('\n');
        let firstDiff = '';
        for (let i = 0; i < Math.max(actualLines.length, expectedLines.length); i++) {
          if (actualLines[i] !== expectedLines[i]) {
            firstDiff = `line ${i + 1}: expected "${expectedLines[i] ?? ''}" got "${actualLines[i] ?? ''}"`;
            break;
          }
        }
        console.error(`  ❌  OUT OF SYNC: ${file}`);
        console.error(`      ${firstDiff}`);
        allOk = false;
      } else {
        console.log(`  ✅  ${file}`);
      }
    }

    console.log('');
    if (allOk) {
      console.log('✨  All rules in sync.\n');
      process.exit(0);
    } else {
      console.error('❌  Some rules are out of sync. Run: npm run build:rules\n');
      process.exit(1);
    }
  });

// ─── pipeline 命令 ──────────────────────────────────────────────────────────
const pipelineCmd = program
  .command('pipeline')
  .description('Pipeline 链式执行管理');

pipelineCmd
  .command('list')
  .description('列出所有可用 Pipeline（内置 + 自定义）')
  .action(async () => {
    const { PIPELINES } = await import('../skills/pipeline');
    const customPipelines = loadCustomPipelines(process.cwd());
    const all = [...PIPELINES, ...customPipelines];
    console.log('\nEthan Pipelines\n');
    console.log('─'.repeat(60));
    for (const p of all) {
      const isCustom = !PIPELINES.find((bp) => bp.id === p.id);
      const tag = isCustom ? ' 🔧 自定义' : '';
      console.log(`\n${p.id}${tag}`);
      console.log(`  名称：${p.name}`);
      console.log(`  描述：${p.description}`);
      console.log(`  Skills：${p.skillIds.join(' → ')}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${PIPELINES.length} 内置 + ${customPipelines.length} 自定义 = ${all.length} pipelines`);
  });

pipelineCmd
  .command('run <name>')
  .description('按 Pipeline 顺序执行各 Skill 提示')
  .option('-c, --context <context>', '输入上下文', '')
  .action(async (name: string, options: { context: string }) => {
    const { resolvePipeline, PIPELINES } = await import('../skills/pipeline');
    const customPipelines = loadCustomPipelines(process.cwd());
    const activeSkills = await getActiveSkills();
    const resolved = resolvePipeline(name, customPipelines, activeSkills);

    if (!resolved) {
      const allIds = [...PIPELINES.map((p) => p.id), ...customPipelines.map((p) => p.id)];
      console.error(`Unknown pipeline: ${name}`);
      console.error(`Available: ${allIds.join(' | ')}`);
      process.exit(1);
    }

    const { pipeline, skills } = resolved;
    console.log(`\n🚀 Pipeline: ${pipeline.name}`);
    console.log(`   ${pipeline.description}`);
    console.log(`   Context: ${options.context || '(none)'}\n`);
    console.log('─'.repeat(60));

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      console.log(`\n[${i + 1}/${skills.length}] ${skill.name} (${skill.id})`);
      console.log(`描述：${skill.description}`);
      console.log(`\n执行步骤：`);
      for (const step of skill.steps) {
        console.log(`  ${step.title}`);
      }
      console.log(`\n输出格式：${skill.outputFormat}`);
      if (i < skills.length - 1) {
        console.log('\n' + '─'.repeat(40));
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n✅ Pipeline "${pipeline.name}" 共 ${skills.length} 个 Skill\n`);

    // Record usage stats
    const stats = readStats();
    for (const skill of skills) {
      stats[skill.id] = (stats[skill.id] || 0) + 1;
    }
    writeStats(stats);
  });

// ─── doctor 命令 ────────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('检查运行环境和构建产物健康状态')
  .action(async () => {
    console.log('\n🩺 Ethan Doctor\n');
    console.log('─'.repeat(60));

    // 1. Node.js version check
    const nodeVersion = process.versions.node;
    const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);
    const nodeOk = nodeMajor >= 18;
    console.log(`\n[环境检查]`);
    console.log(
      `  Node.js: v${nodeVersion} ${nodeOk ? '✅' : '❌ (需要 Node.js >= 18)'}`
    );

    // 2. MCP SDK check
    const sdkOk = fs.existsSync(
      path.join(__dirname, '../../node_modules/@modelcontextprotocol/sdk')
    );
    console.log(`  @modelcontextprotocol/sdk: ${sdkOk ? '✅ 已安装' : '❌ 未安装'}`);

    // 3. Rules files status
    const ROOT = path.join(__dirname, '../..');

    const { renderCursorMdc, renderCursorOld } = await import('../templates/cursor-mdc.template');
    const { renderMarkdown } = await import('../templates/copilot-md.template');

    const FIXED_TS = '1970-01-01T00:00:00.000Z';
    function makeCtx(platform: Platform): BuildContext {
      return { platform, skills: ALL_SKILLS, generatedAt: FIXED_TS, version: pkg.version };
    }
    const TS_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g;
    function normalize(content: string): string {
      return content.replace(TS_REGEX, 'TIMESTAMP');
    }

    const ruleFiles = [
      { file: 'rules/cursor/smart-flow.mdc', platform: '  Cursor 新版    ', expected: () => renderCursorMdc(makeCtx('cursor-new')) },
      { file: 'rules/cursor/.cursorrules', platform: '  Cursor 旧版    ', expected: () => renderCursorOld(makeCtx('cursor-old')) },
      { file: 'rules/copilot/copilot-instructions.md', platform: '  VS Code Copilot', expected: () => renderMarkdown(makeCtx('copilot')) },
      { file: 'rules/cline/.clinerules', platform: '  Cline          ', expected: () => renderMarkdown(makeCtx('cline')) },
      { file: 'rules/lingma/smart-flow.md', platform: '  通义灵码       ', expected: () => renderMarkdown(makeCtx('lingma')) },
      { file: 'rules/codebuddy/CODEBUDDY.md', platform: '  腾讯 CodeBuddy ', expected: () => renderMarkdown(makeCtx('codebuddy')) },
      { file: 'rules/windsurf/.windsurf/rules/smart-flow.md', platform: '  Windsurf       ', expected: () => renderMarkdown(makeCtx('windsurf')) },
      { file: 'rules/zed/smart-flow.rules', platform: '  Zed            ', expected: () => renderMarkdown(makeCtx('zed')) },
      { file: 'rules/jetbrains/smart-flow.md', platform: '  JetBrains AI   ', expected: () => renderMarkdown(makeCtx('jetbrains')) },
      { file: 'rules/continue/.continuerules', platform: '  Continue       ', expected: () => renderMarkdown(makeCtx('continue')) },
      { file: 'rules/claude-code/CLAUDE.md', platform: '  Claude Code    ', expected: () => renderMarkdown(makeCtx('claude-code')) },
    ];

    console.log(`\n[规则文件状态]`);
    console.log(`  ${'平台'.padEnd(18)} ${'已构建'.padEnd(8)} ${'最新'.padEnd(8)}`);
    console.log(`  ${'-'.repeat(36)}`);

    for (const { file, platform, expected } of ruleFiles) {
      const filePath = path.join(ROOT, file);
      const built = fs.existsSync(filePath);
      let latest = false;
      if (built) {
        const actual = fs.readFileSync(filePath, 'utf-8');
        latest = normalize(actual) === normalize(expected());
      }
      const builtStr = built ? '✅' : '❌';
      const latestStr = built ? (latest ? '✅' : '⚠️  需重建') : '-';
      console.log(`  ${platform} ${builtStr.padEnd(8)} ${latestStr}`);
    }

    console.log('\n' + '─'.repeat(60));

    const allBuilt = ruleFiles.every(({ file }) => fs.existsSync(path.join(ROOT, file)));
    if (!allBuilt) {
      console.log('\n💡 提示：运行 npm run build:rules 生成规则文件\n');
    } else {
      console.log('\n✅ 所有检查完成\n');
    }
  });

// ─── serve 命令（Web UI Dashboard） ─────────────────────────────────────────
program
  .command('serve')
  .description('启动本地 Web UI Dashboard（默认端口 3000）')
  .option('--port <port>', '监听端口', '3000')
  .action(async (options) => {
    const port = parseInt(options.port, 10) || 3000;
    const { startDashboardServer } = await import('../server/dashboard');
    startDashboardServer(port, process.cwd());
  });

// ─── run 命令（交互式向导） ──────────────────────────────────────────────────
program
  .command('run')
  .description('交互式 Skill 执行向导：选择 Skill → 填写上下文 → 生成提示词')
  .action(async () => {
    const clack = await import('@clack/prompts');
    const { intro, outro, select, text, isCancel, cancel, note, spinner } = clack;

    // 读取项目配置
    const config = readConfig(process.cwd());
    const isEn = config.lang === 'en';
    const activeSkills = ALL_SKILLS.filter(
      (s) => !config.disabledSkills?.includes(s.id)
    );

    intro(isEn ? '✨  Ethan - Skill Wizard' : '✨  Ethan - 技能执行向导');

    // 按分类分组展示
    const categoryLabel: Record<string, string> = {
      '需求侧': isEn ? '[Requirements]' : '[需求侧]',
      '执行侧': isEn ? '[Execution]' : '[执行侧]',
      '跟踪侧': isEn ? '[Tracking]' : '[跟踪侧]',
      '输出侧': isEn ? '[Output]' : '[输出侧]',
      '质量侧': isEn ? '[Quality]' : '[质量侧]',
    };

    const skillOptions = activeSkills.map((s) => ({
      value: s.id,
      label: isEn
        ? `${s.nameEn.replace(/_/g, ' ')}  ${categoryLabel[s.category ?? ''] ?? ''}`
        : `${s.name}  ${categoryLabel[s.category ?? ''] ?? ''}`,
      hint: isEn ? (s.descriptionEn ?? s.description) : s.description,
    }));

    const skillId = await select({
      message: isEn ? 'Which Skill do you want to run?' : '选择要执行的 Skill：',
      options: skillOptions,
    });

    if (isCancel(skillId)) {
      cancel(isEn ? 'Cancelled.' : '已取消');
      process.exit(0);
    }

    const skill = ALL_SKILLS.find((s) => s.id === skillId)!;

    const context = await text({
      message: isEn
        ? `Describe your context for "${skill.nameEn.replace(/_/g, ' ')}":`
        : `请输入「${skill.name}」的上下文描述：`,
      placeholder: isEn
        ? 'e.g. Build a user login feature with JWT auth'
        : '例如：实现用户登录功能，支持 JWT 认证',
      validate: (v) => {
        if (!v?.trim()) return isEn ? 'Context cannot be empty' : '上下文不能为空';
      },
    });

    if (isCancel(context)) {
      cancel(isEn ? 'Cancelled.' : '已取消');
      process.exit(0);
    }

    const s = spinner();
    s.start(isEn ? 'Generating prompt...' : '生成提示词中...');

    // 组装完整提示词
    const stepsText = skill.steps
      .map((step, i) => `${i + 1}. ${step.title.replace(/^\d+\.\s*/, '')}`)
      .join('\n');

    const prompt = [
      `## ${isEn ? skill.nameEn.replace(/_/g, ' ') : skill.name}`,
      '',
      `**${isEn ? 'Context' : '上下文'}**: ${context}`,
      '',
      `**${isEn ? 'Goal' : '目标'}**: ${isEn ? (skill.descriptionEn ?? skill.description) : skill.description}`,
      '',
      `**${isEn ? 'Please follow these steps' : '请按以下步骤执行'}**:`,
      stepsText,
      '',
      `**${isEn ? 'Output format' : '输出格式'}**: ${skill.outputFormat}`,
    ].join('\n');

    s.stop(isEn ? 'Prompt ready!' : '提示词已生成！');

    note(prompt, isEn ? 'Your Prompt' : '你的提示词');

    // 尝试复制到剪贴板
    if (copyToClipboard(prompt)) {
      outro(
        isEn
          ? '✅ Prompt copied to clipboard! Paste it into your AI editor.'
          : '✅ 提示词已复制到剪贴板！粘贴到你的 AI 编辑器中使用。'
      );
    } else {
      outro(
        isEn
          ? '✅ Done! Copy the prompt above and paste it into your AI editor.'
          : '✅ 完成！请复制上方提示词，粘贴到你的 AI 编辑器中使用。'
      );
    }

    // 记录使用统计
    const stats = readStats();
    stats[skill.id] = (stats[skill.id] || 0) + 1;
    writeStats(stats);
  });

// ─── init 命令 ───────────────────────────────────────────────────────────────
program
  .command('init')
  .description('在当前项目生成 .ethanrc.json 配置文件')
  .option('-d, --dir <dir>', '目标目录（默认为当前目录）', process.cwd())
  .action(async (options) => {
    const { dir } = options;
    const configPath = getConfigPath(dir);

    if (fs.existsSync(configPath)) {
      const existing = readConfig(dir);
      console.log(`\n⚠️  ${configPath} 已存在，当前配置：`);
      console.log(JSON.stringify(existing, null, 2));
      console.log('\n如需修改，请直接编辑该文件。\n');
      return;
    }

    // 使用 readline 简单交互
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

    console.log('\n🚀 Ethan 项目配置向导\n');
    console.log('─'.repeat(50));

    const langInput = await ask('\n输出语言 [zh/en]（默认 zh）: ');
    const lang: 'zh' | 'en' = langInput === 'en' ? 'en' : 'zh';

    const disabledInput = await ask(
      '\n要禁用的 Skill ID（逗号分隔，留空跳过）\n可选: ' +
        ALL_SKILLS.map((s) => s.id).join(', ') +
        '\n> '
    );
    const disabledSkills = disabledInput
      ? disabledInput
          .split(',')
          .map((s) => s.trim())
          .filter((s) => ALL_SKILLS.some((sk) => sk.id === s))
      : [];

    const customTriggersInput = await ask(
      '\n自定义触发词（格式: 缩写=skill-id，逗号分隔，留空跳过）\n例如: cr=code-review,fix=debug\n> '
    );
    const customTriggers: Record<string, string> = {};
    if (customTriggersInput) {
      for (const pair of customTriggersInput.split(',')) {
        const [key, val] = pair.split('=').map((s) => s.trim());
        if (key && val && ALL_SKILLS.some((sk) => sk.id === val)) {
          customTriggers[key] = val;
        }
      }
    }

    rl.close();

    const config = {
      lang,
      ...(disabledSkills.length > 0 ? { disabledSkills } : {}),
      ...(Object.keys(customTriggers).length > 0 ? { customTriggers } : {}),
    };

    writeConfig(config, dir);

    console.log('\n✅ 已生成 .ethanrc.json：');
    console.log(JSON.stringify(config, null, 2));
    console.log(`\n文件路径：${configPath}`);
    console.log('\n💡 提示：现在运行 ethan install --platform <platform> 将使用此配置\n');
  });

// ─── workflow 命令（有状态一键工作流） ──────────────────────────────────────
const workflowCmd = program.command('workflow').description('有状态工作流执行：一键推进各阶段任务');

workflowCmd
  .command('start [pipelineId]')
  .description('启动工作流会话，输出第一步提示词（无参数时显示 Pipeline 选择菜单）')
  .option('-c, --context <context>', '初始任务上下文', '')
  .option('-n, --name <name>', '具名会话（存至 .ethan/sessions/<name>.json，可并行多个工作流）')
  .action(async (pipelineId: string | undefined, options: { context: string; name?: string }) => {
    const {
      loadSession,
      createSession,
      buildStepPrompt,
      calcProgress,
    } = await import('../workflow/state');
    const { resolvePipeline, PIPELINES } = await import('../skills/pipeline');

    // 检查是否已有进行中的 session（具名会话不覆盖默认）
    const existing = loadSession(process.cwd(), options.name);
    if (existing && !existing.completed) {
      console.log('\n⚠️  已有进行中的工作流：');
      console.log(`   Pipeline: ${existing.pipelineName}`);
      if (existing.name) console.log(`   会话名: ${existing.name}`);
      console.log(`   进度: ${calcProgress(existing)}%`);
      console.log('\n💡 使用 ethan workflow status 查看进度');
      console.log('   使用 ethan workflow reset 重置后再启动新工作流\n');
      return;
    }

    let id = pipelineId;

    // 无参数时，显示交互式 Pipeline 选择菜单
    if (!id) {
      const customPipelines = loadCustomPipelines(process.cwd());
      const allPipelines = [
        ...PIPELINES,
        ...customPipelines.map((p) => ({ id: p.id, name: p.name, description: p.description, skillIds: p.skillIds })),
      ];

      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

      console.log('\n🔄 可用工作流 Pipeline\n');
      console.log('─'.repeat(60));
      allPipelines.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}  [${p.id}]`);
        console.log(`     ${p.description}`);
        console.log(`     步骤: ${p.skillIds.join(' → ')}`);
        console.log('');
      });

      const choice = await ask(`选择 Pipeline（输入序号 1-${allPipelines.length}，或直接输入 ID）：\n> `);
      rl.close();

      if (!choice) {
        console.error('\n❌ 未选择 Pipeline\n');
        process.exit(1);
      }

      const num = parseInt(choice, 10);
      if (!isNaN(num) && num >= 1 && num <= allPipelines.length) {
        id = allPipelines[num - 1].id;
      } else {
        id = choice;
      }
    }

    let resolved = resolvePipeline(id!);

    // 尝试从自定义 YAML pipeline 加载
    if (!resolved) {
      const customPipelines = loadCustomPipelines(process.cwd());
      const custom = customPipelines.find((p) => p.id === id);
      if (custom) {
        const customSkills = custom.skillIds
          .map((sid) => ALL_SKILLS.find((s) => s.id === sid))
          .filter((s): s is NonNullable<typeof s> => s !== null);
        if (customSkills.length > 0) {
          resolved = {
            pipeline: {
              id: custom.id,
              name: custom.name,
              description: custom.description,
              skillIds: custom.skillIds,
            },
            skills: customSkills,
          };
        }
      }
    }

    if (!resolved) {
      const customPipelines = loadCustomPipelines(process.cwd());
      const allIds = [...PIPELINES.map((p) => p.id), ...customPipelines.map((p) => p.id)];
      console.error(`Unknown pipeline: ${id}`);
      console.error(`Available: ${allIds.join(' | ')}`);
      process.exit(1);
    }

    const { pipeline, skills } = resolved;

    // 交互式获取上下文（如果未传）
    let context = options.context.trim();
    if (!context) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
      console.log(`\n🚀 启动工作流：${pipeline.name}`);
      console.log(`   ${pipeline.description}\n`);
      context = await ask('请描述你的任务背景（例如：实现用户登录功能，支持 JWT 认证）：\n> ');
      rl.close();
      if (!context) {
        console.error('\n❌ 任务上下文不能为空\n');
        process.exit(1);
      }
    }

    const session = createSession(pipeline, context, process.cwd(), options.name);
    const firstStep = session.steps[0];
    const firstSkill = skills[0];

    console.log(`\n🚀 工作流已启动：${pipeline.name}`);
    console.log(`   ID: ${session.id}`);
    if (session.name) console.log(`   会话名: ${session.name}`);
    console.log(`   共 ${session.steps.length} 步\n`);
    console.log('─'.repeat(60));

    const prompt = buildStepPrompt(session, firstStep, firstSkill);
    console.log('\n' + prompt + '\n');
    console.log('─'.repeat(60));

    // 复制到剪贴板
    if (copyToClipboard(prompt)) {
      console.log('\n✅ 提示词已复制到剪贴板！粘贴到你的 AI 编辑器中执行。');
    }

    console.log(`\n💡 完成本步后，运行：ethan workflow done${session.name ? ` --name ${session.name}` : ''}\n`);

    // 记录使用统计
    const stats = readStats();
    stats[firstSkill.id] = (stats[firstSkill.id] || 0) + 1;
    writeStats(stats);
  });

workflowCmd
  .command('use [name]')
  .description('设置当前工作目录的活跃会话（后续命令无需 --name）；不传 name 则显示当前激活会话')
  .action(async (name?: string) => {
    const { getCurrentSessionName, setCurrentSessionName, clearCurrentSessionName, loadSession } =
      await import('../workflow/state');

    if (!name) {
      const current = getCurrentSessionName(process.cwd());
      if (!current) {
        console.log('\n📌 当前无激活会话（使用默认 workflow.json）');
        console.log('   运行 ethan workflow use <name> 激活一个具名会话\n');
      } else {
        const session = loadSession(process.cwd(), current);
        console.log(`\n📌 当前激活会话：${current}`);
        if (session) {
          const { calcProgress } = await import('../workflow/state');
          console.log(`   Pipeline: ${session.pipelineName}`);
          console.log(`   进度: ${calcProgress(session)}%`);
        }
        console.log('\n   运行 ethan workflow use （不带参数）可查看，ethan workflow use default 可切回默认\n');
      }
      return;
    }

    if (name === 'default' || name === '-') {
      clearCurrentSessionName(process.cwd());
      console.log('\n✅ 已切换回默认会话（workflow.json）\n');
      return;
    }

    const session = loadSession(process.cwd(), name);
    if (!session) {
      console.error(`\n❌ 未找到具名会话：${name}`);
      console.error('   使用 ethan workflow list 查看所有会话\n');
      process.exit(1);
    }

    setCurrentSessionName(process.cwd(), name);
    const { calcProgress } = await import('../workflow/state');
    console.log(`\n✅ 已激活会话：${name}`);
    console.log(`   Pipeline: ${session.pipelineName}`);
    console.log(`   进度: ${calcProgress(session)}%`);
    console.log('\n   后续 workflow done/status/reset 将自动使用此会话（无需 --name）\n');
  });

workflowCmd
  .command('done [summary]')
  .description('完成当前步骤，自动推进到下一步（摘要可选）')
  .option('-n, --name <name>', '具名会话名称')
  .option('-r, --rating <rating>', '评分本步 Skill 质量（1-5）')
  .action(async (summary: string | undefined, options: { name?: string; rating?: string }) => {
    const {
      loadSession,
      markStepDone,
      buildStepPrompt,
      getCurrentStep,
      getCurrentStepIndex,
      calcProgress,
    } = await import('../workflow/state');
    const { resolvePipeline } = await import('../skills/pipeline');

    const session = loadSession(process.cwd(), options.name);
    if (!session) {
      console.error('\n❌ 未找到进行中的工作流。运行 ethan workflow start 启动。\n');
      process.exit(1);
    }
    if (session.completed) {
      console.log('\n🎉 工作流已全部完成！运行 ethan workflow reset 开始新工作流。\n');
      return;
    }

    const currentStep = getCurrentStep(session);
    if (!currentStep) {
      console.error('\n❌ 未找到当前步骤，工作流状态异常。\n');
      process.exit(1);
    }

    // 获取摘要（命令行参数，可选）
    const stepSummary = summary?.trim() ?? '';

    const nextStep = markStepDone(session, stepSummary, process.cwd());
    const progress = calcProgress(session);

    // 自动归档到 Skill Memory（T16）
    archiveWorkflowToMemory(
      session.id,
      currentStep.skillId,
      session.pipelineName,
      stepSummary,
      process.cwd()
    );

    // 记录 Skill 质量评分（--rating 1-5）
    if (options.rating !== undefined) {
      const ratingNum = parseInt(options.rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        console.warn('⚠️  评分无效，已忽略（必须为 1-5 的整数）');
      } else {
        const statsData = readStatsV2();
        if (!statsData.ratings) statsData.ratings = {};
        if (!statsData.ratings[currentStep.skillId]) statsData.ratings[currentStep.skillId] = [];
        statsData.ratings[currentStep.skillId].push(ratingNum);
        writeStatsV2(statsData);
        console.log(`⭐ 已记录评分 ${ratingNum}/5 → ${currentStep.skillId}`);
      }
    }

    if (!nextStep) {
      console.log('\n🎉 恭喜！工作流全部完成！');
      console.log(`   Pipeline: ${session.pipelineName}`);
      console.log(`   进度: ${progress}%`);
      console.log(`\n📄 运行 ethan workflow status 查看完整报告`);
      console.log(`   运行 ethan workflow reset 开始新工作流\n`);
      return;
    }

    // 加载下一步 Skill 信息
    const resolved = resolvePipeline(session.pipelineId);
    if (!resolved) {
      console.error('\n❌ 无法加载 Pipeline 信息\n');
      process.exit(1);
    }
    const nextSkill = resolved.skills.find((s) => s.id === nextStep.skillId);
    if (!nextSkill) {
      console.error(`\n❌ 未找到 Skill：${nextStep.skillId}\n`);
      process.exit(1);
    }

    console.log(`\n✅ 已完成 ${session.steps.filter((s) => s.status === 'done').length}/${session.steps.length} 步（${progress}%）`);
    console.log('─'.repeat(60));

    const prompt = buildStepPrompt(session, nextStep, nextSkill);
    console.log('\n' + prompt + '\n');
    console.log('─'.repeat(60));

    // 复制到剪贴板
    if (copyToClipboard(prompt)) {
      console.log('\n✅ 下一步提示词已复制到剪贴板！');
    }

    console.log(`\n💡 完成本步后，运行：ethan workflow done${session.name ? ` --name ${session.name}` : ''}\n`);

    // 记录使用统计
    const stats = readStats();
    stats[nextSkill.id] = (stats[nextSkill.id] || 0) + 1;
    writeStats(stats);
  });

workflowCmd
  .command('status')
  .description('查看当前工作流进度看板')
  .option('-n, --name <name>', '具名会话名称')
  .action(async (options: { name?: string }) => {
    const {
      loadSession,
      getCurrentStepIndex,
      calcProgress,
    } = await import('../workflow/state');

    const session = loadSession(process.cwd(), options.name);
    if (!session) {
      console.log('\n📋 当前目录暂无工作流会话。\n');
      console.log('   运行 ethan workflow start 启动新工作流\n');
      return;
    }

    const progress = calcProgress(session);
    const currentIdx = session.completed ? -1 : getCurrentStepIndex(session);

    const statusIcon: Record<string, string> = {
      'done': '✅',
      'in-progress': '▶️ ',
      'pending': '⬜',
      'skipped': '⏭️ ',
    };

    console.log('\n📋 工作流进度看板');
    console.log('─'.repeat(60));
    console.log(`  Pipeline : ${session.pipelineName}`);
    console.log(`  Session  : ${session.id}`);
    if (session.name) console.log(`  会话名   : ${session.name}`);
    console.log(`  创建时间  : ${session.createdAt.slice(0, 19).replace('T', ' ')}`);
    console.log(`  更新时间  : ${session.updatedAt.slice(0, 19).replace('T', ' ')}`);
    console.log(`  总进度   : [${'█'.repeat(Math.round(progress / 5))}${'░'.repeat(20 - Math.round(progress / 5))}] ${progress}%`);
    console.log(`  状态     : ${session.completed ? '🎉 已完成' : `第 ${currentIdx + 1}/${session.steps.length} 步进行中`}`);
    console.log('\n[步骤明细]\n');

    for (let i = 0; i < session.steps.length; i++) {
      const step = session.steps[i];
      const icon = statusIcon[step.status] ?? '❓';
      const isCurrent = i === currentIdx;
      const marker = isCurrent ? ' ◀ 当前' : '';
      console.log(`  ${icon} ${i + 1}. ${step.skillId}${marker}`);
      if (step.summary) {
        const preview = step.summary.length > 80 ? step.summary.slice(0, 80) + '…' : step.summary;
        console.log(`       摘要：${preview}`);
      }
      if (step.completedAt) {
        console.log(`       完成：${step.completedAt.slice(0, 19).replace('T', ' ')}`);
      }
    }

    console.log('\n' + '─'.repeat(60));
    if (session.completed) {
      console.log('\n🎉 工作流已全部完成！运行 ethan workflow reset 开始新工作流\n');
    } else {
      console.log(`\n💡 当前任务背景：${session.initialContext}`);
      console.log(`   完成当前步骤后运行：ethan workflow done${session.name ? ` --name ${session.name}` : ''}\n`);
    }
  });

workflowCmd
  .command('reset')
  .description('清除当前工作流会话（不可恢复）')
  .option('-n, --name <name>', '具名会话名称')
  .action(async (options: { name?: string }) => {
    const { loadSession, deleteSession, calcProgress } = await import('../workflow/state');

    const session = loadSession(process.cwd(), options.name);
    if (!session) {
      console.log('\n📋 当前目录无工作流会话，无需重置。\n');
      return;
    }

    const progress = calcProgress(session);

    // 简单确认
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, (a) => resolve(a.trim().toLowerCase())));

    console.log(`\n⚠️  即将重置工作流：${session.pipelineName}（进度 ${progress}%）`);
    const confirm = await ask('确认重置？(y/N): ');
    rl.close();

    if (confirm !== 'y' && confirm !== 'yes') {
      console.log('\n已取消重置。\n');
      return;
    }

    deleteSession(process.cwd(), options.name);
    console.log('\n✅ 工作流已重置。运行 ethan workflow start 开始新工作流。\n');
  });

workflowCmd
  .command('list')
  .description('列出所有进行中的会话（具名 + 默认）')
  .action(async () => {
    const { loadSession, calcProgress, listNamedSessions, getCurrentSessionName } = await import('../workflow/state');

    const currentActiveName = getCurrentSessionName(process.cwd());
    const defaultSession = loadSession(process.cwd(), undefined);
    const namedSessions = listNamedSessions(process.cwd());

    console.log('\n📂 工作流会话\n');
    console.log('─'.repeat(60));

    // 默认会话
    if (defaultSession) {
      const pct = calcProgress(defaultSession);
      const statusLabel = defaultSession.completed ? '🎉 已完成' : `${pct}% 进行中`;
      const activeTag = !currentActiveName ? ' ◀ 当前激活' : '';
      console.log(`\n  📋 默认会话${activeTag}  [${statusLabel}]`);
      console.log(`     Pipeline: ${defaultSession.pipelineName}`);
      console.log(`     背景: ${defaultSession.initialContext.slice(0, 60)}${defaultSession.initialContext.length > 60 ? '…' : ''}`);
      console.log(`     更新: ${defaultSession.updatedAt.slice(0, 19).replace('T', ' ')}`);
    }

    // 具名会话
    if (namedSessions.length > 0) {
      for (const s of namedSessions) {
        const pct = calcProgress(s);
        const statusLabel = s.completed ? '🎉 已完成' : `${pct}% 进行中`;
        const isActive = s.name === currentActiveName;
        const activeTag = isActive ? ' ◀ 当前激活' : '';
        console.log(`\n  📌 ${s.name || s.id}${activeTag}  [${statusLabel}]`);
        console.log(`     Pipeline: ${s.pipelineName}`);
        console.log(`     背景: ${s.initialContext.slice(0, 60)}${s.initialContext.length > 60 ? '…' : ''}`);
        console.log(`     更新: ${s.updatedAt.slice(0, 19).replace('T', ' ')}`);
      }
    }

    if (!defaultSession && namedSessions.length === 0) {
      console.log('   暂无工作流会话。');
    }

    console.log('\n' + '─'.repeat(60));
    console.log('\n💡 启动工作流：ethan workflow start');
    console.log('   激活会话：  ethan workflow use <session-name>');
    console.log('   查看 Pipeline：ethan pipeline list\n');
  });

workflowCmd
  .command('report')
  .description('生成当前工作流的完成报告（Markdown 格式）')
  .option('--out <file>', '输出到文件（默认打印到终端）')
  .option('--all', '包含未完成步骤（默认只展示已完成步骤）')
  .action(async (options: { out?: string; all?: boolean }) => {
    const { loadSession, calcProgress } = await import('../workflow/state');

    const session = loadSession(process.cwd());
    if (!session) {
      console.error('\n❌ 未找到工作流会话。运行 ethan workflow start 启动工作流。\n');
      process.exit(1);
    }

    const doneSteps = session.steps.filter((s) => s.status === 'done');
    const progress = calcProgress(session);

    // 计算总耗时
    let duration = '';
    if (doneSteps.length > 0) {
      const first = session.steps.find((s) => s.startedAt ?? s.completedAt);
      const last = doneSteps[doneSteps.length - 1];
      if (first && last.completedAt) {
        const startMs = new Date(first.startedAt ?? session.createdAt).getTime();
        const endMs = new Date(last.completedAt).getTime();
        const diffMin = Math.round((endMs - startMs) / 60000);
        duration = diffMin < 1 ? '< 1 分钟' : `${diffMin} 分钟`;
      }
    }

    const fmt = (iso: string) => iso.slice(0, 19).replace('T', ' ');
    const statusIcon: Record<string, string> = {
      done: '✅', 'in-progress': '▶️', pending: '⬜', skipped: '⏭️',
    };

    const lines: string[] = [];

    // ── 标题 ──────────────────────────────────────────────────────────────
    lines.push(`# 工作流报告：${session.pipelineName}`);
    lines.push('');

    // ── 元信息 ────────────────────────────────────────────────────────────
    lines.push('## 概览');
    lines.push('');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|----|`);
    lines.push(`| Pipeline | \`${session.pipelineId}\` |`);
    lines.push(`| Session ID | \`${session.id}\` |`);
    lines.push(`| 任务背景 | ${session.initialContext} |`);
    lines.push(`| 创建时间 | ${fmt(session.createdAt)} |`);
    lines.push(`| 最后更新 | ${fmt(session.updatedAt)} |`);
    if (duration) lines.push(`| 总耗时 | ${duration} |`);
    lines.push(`| 进度 | ${progress}%（${doneSteps.length}/${session.steps.length} 步完成）|`);
    lines.push(`| 状态 | ${session.completed ? '🎉 已全部完成' : '🔄 进行中'} |`);
    lines.push('');

    // ── 步骤详情 ──────────────────────────────────────────────────────────
    lines.push('## 步骤详情');
    lines.push('');

    const stepsToShow = options.all
      ? session.steps
      : session.steps.filter((s) => s.status === 'done' || s.status === 'skipped');

    if (stepsToShow.length === 0) {
      lines.push('_暂无已完成步骤。_');
    } else {
      for (let i = 0; i < session.steps.length; i++) {
        const step = session.steps[i];
        if (!options.all && step.status !== 'done' && step.status !== 'skipped') continue;

        const icon = statusIcon[step.status] ?? '⬜';
        const skill = ALL_SKILLS.find((s) => s.id === step.skillId);
        const skillName = skill ? `${skill.name}（${step.skillId}）` : step.skillId;

        lines.push(`### ${icon} 第 ${i + 1} 步：${skillName}`);
        lines.push('');

        if (step.startedAt) lines.push(`- **开始时间**：${fmt(step.startedAt)}`);
        if (step.completedAt) lines.push(`- **完成时间**：${fmt(step.completedAt)}`);
        if (step.startedAt && step.completedAt) {
          const mins = Math.round(
            (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 60000
          );
          if (mins > 0) lines.push(`- **耗时**：${mins} 分钟`);
        }
        lines.push('');

        if (step.summary) {
          lines.push('**产出摘要：**');
          lines.push('');
          lines.push(`> ${step.summary.replace(/\n/g, '\n> ')}`);
          lines.push('');
        } else if (step.status === 'done') {
          lines.push('_（本步无摘要记录）_');
          lines.push('');
        }
      }
    }

    // ── 未完成步骤（仅在进行中时显示） ────────────────────────────────────
    if (!session.completed && !options.all) {
      const remaining = session.steps.filter(
        (s) => s.status === 'pending' || s.status === 'in-progress'
      );
      if (remaining.length > 0) {
        lines.push('## 待完成步骤');
        lines.push('');
        for (const step of remaining) {
          const icon = statusIcon[step.status] ?? '⬜';
          const skill = ALL_SKILLS.find((s) => s.id === step.skillId);
          const skillName = skill ? skill.name : step.skillId;
          lines.push(`- ${icon} ${skillName}（\`${step.skillId}\`）`);
        }
        lines.push('');
      }
    }

    // ── 尾注 ──────────────────────────────────────────────────────────────
    lines.push('---');
    lines.push('');
    lines.push(`_由 [Ethan](https://github.com/aokiz-ek/smart-flow-skill) v${pkg.version} 生成 · ${new Date().toISOString().slice(0, 10)}_`);
    lines.push('');

    const report = lines.join('\n');

    if (options.out) {
      const outPath = path.resolve(process.cwd(), options.out);
      fs.writeFileSync(outPath, report, 'utf-8');
      console.log(`\n✅ 报告已保存到：${outPath}\n`);
    } else {
      console.log('\n' + report);
    }
  });

// ─── scan 命令（T06）────────────────────────────────────────────────────────
program
  .command('scan')
  .description('扫描项目代码健康状况：TODO/FIXME、高频修改热点、过期依赖等')
  .option('--todo', '只扫描 TODO / FIXME / HACK / XXX 注释')
  .option('--deps', '只检查依赖过期情况（读取 package.json）')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    const cwd = process.cwd();

    // ── TODO 扫描 ──────────────────────────────────────────────────────────
    const todoResult = spawnSync(
      'grep',
      ['-rn', '--include=*.ts', '--include=*.js', '--include=*.tsx', '--include=*.jsx',
        '--exclude-dir=node_modules', '--exclude-dir=dist', '--exclude-dir=.git',
        '-E', '(TODO|FIXME|HACK|XXX):', '.'],
      { encoding: 'utf-8', cwd }
    );
    const todoLines = (todoResult.stdout || '').trim().split('\n').filter(Boolean);

    // ── 依赖检查 ────────────────────────────────────────────────────────────
    let depsSection = '';
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
      };
      const depList = Object.entries(allDeps)
        .map(([name, ver]) => `  ${name}: ${ver}`)
        .join('\n');
      depsSection = `\n## 当前依赖\n\`\`\`\n${depList}\n\`\`\`\n`;
    }

    if (options.deps && !options.todo) {
      if (!depsSection) {
        console.error('❌ 当前目录未找到 package.json');
        process.exit(1);
      }
    }

    const todoSection =
      todoLines.length > 0
        ? `\n## TODO / FIXME 注释（${todoLines.length} 条）\n\`\`\`\n${todoLines.slice(0, 50).join('\n')}${todoLines.length > 50 ? `\n[...还有 ${todoLines.length - 50} 条]` : ''}\n\`\`\`\n`
        : '\n## TODO / FIXME 注释\n无\n';

    const prompt = `你是一名代码质量工程师，请根据以下项目扫描结果给出改进建议。

## 任务
分析代码库的健康状况，输出优先级排序的改进建议清单。

## 项目路径
${cwd}
${options.todo && !options.deps ? todoSection : options.deps && !options.todo ? depsSection : todoSection + depsSection}
## 输出格式
1. **健康评分**（0-100，含简短评语）
2. **高优先级问题**（需立即处理）
3. **中优先级建议**（本周内处理）
4. **低优先级优化**（有时间再说）
5. **总结**（一句话）

请给出具体可操作的建议，每条建议说明原因和影响。`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ 扫描报告提示词已复制到剪贴板（${todoLines.length} 个 TODO）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── explain 命令（T07）─────────────────────────────────────────────────────
program
  .command('explain [file]')
  .description('解释代码文件或指定行范围，生成易读解释提示词')
  .option('--lines <range>', '行范围，如 10-50')
  .option(
    '--level <level>',
    '解释深度：junior（入门）| senior（深度）| rubber-duck（橡皮鸭调试）',
    'senior'
  )
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((file, options) => {
    let code = '';
    let codeLabel = '';

    if (file) {
      const filePath = resolveFilePath(file);
      assertFileExists(filePath, file);
      const allLines = fs.readFileSync(filePath, 'utf-8').split('\n');
      if (options.lines) {
        const [start, end] = options.lines.split('-').map(Number);
        code = allLines.slice((start || 1) - 1, end || allLines.length).join('\n');
        codeLabel = `${file}（第 ${start}-${end} 行）`;
      } else {
        code = allLines.join('\n');
        codeLabel = file;
      }
    } else {
      console.error('❌ 请提供文件路径，如：ethan explain src/utils.ts --lines 1-50');
      process.exit(1);
    }

    const levelGuide: Record<string, string> = {
      junior: '用简单直白的语言解释，避免术语，适合初级开发者理解',
      senior: '深入分析设计意图、架构决策和潜在问题，适合有经验的开发者',
      'rubber-duck': '像对橡皮鸭调试一样逐行解释，帮助理解代码执行流程和找出 bug',
    };

    const guide = levelGuide[options.level] || levelGuide['senior'];

    const truncatedCode = code.length > 6000 ? code.slice(0, 6000) + '\n[...代码已截断...]' : code;

    const prompt = `你是一名经验丰富的工程师，请解释以下代码。

## 解释风格
${guide}

## 代码来源
${codeLabel}

## 代码
\`\`\`
${truncatedCode}
\`\`\`

## 输出格式
1. **核心功能**（一句话）
2. **逐块解析**（每个关键部分的作用）
3. **关键技术点**（使用的设计模式/算法/API）
4. **潜在问题或改进点**（若有）`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ 代码解释提示词已复制到剪贴板（${codeLabel}）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── test-case 命令（T08）───────────────────────────────────────────────────
program
  .command('test-case <file>')
  .description('为源文件生成测试用例提示词')
  .option(
    '--framework <fw>',
    '测试框架：vitest | jest | mocha | jasmine | pytest | go-test',
    'vitest'
  )
  .option('--coverage <level>', '覆盖目标：basic | full | edge-cases', 'full')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((file, options) => {
    const filePath = resolveFilePath(file);
    assertFileExists(filePath, file);
    const code = fs.readFileSync(filePath, 'utf-8');
    const truncatedCode = code.length > 6000 ? code.slice(0, 6000) + '\n[...已截断...]' : code;

    const coverageGuide: Record<string, string> = {
      basic: '覆盖主要功能路径，确保 happy path 通过',
      full: '覆盖所有分支（if/else/switch）、正常路径和错误路径',
      'edge-cases': '重点覆盖边界条件：空值、极值、并发、异常抛出、类型异常等',
    };

    const prompt = `你是一名测试工程师，请为以下代码生成完整的测试用例。

## 要求
- **框架**：${options.framework}
- **覆盖目标**：${coverageGuide[options.coverage] || coverageGuide['full']}
- 每个测试用例包含：describe 描述、it/test 名称、arrange/act/assert 结构
- 对异步代码使用 async/await
- Mock 外部依赖（文件系统、网络请求、数据库等）

## 源文件
${file}

## 源代码
\`\`\`
${truncatedCode}
\`\`\`

## 输出格式
直接输出完整可运行的测试文件，包含所有 import 语句，使用 ${options.framework} 语法。
文件名建议：${path.basename(file, path.extname(file))}.test${path.extname(file)}`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ 测试用例提示词已复制到剪贴板（${file}）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── naming 命令（T09）──────────────────────────────────────────────────────
program
  .command('naming <description>')
  .description('根据描述生成命名候选（变量/函数/组件/文件等）')
  .option('--style <style>', '命名风格：camelCase | PascalCase | snake_case | kebab-case | all', 'all')
  .option('--lang <lang>', '语言上下文：ts | js | python | go | rust | java', 'ts')
  .option('--count <n>', '每种类型生成几个候选', '5')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((description, options) => {
    const count = parseInt(options.count, 10) || 5;
    const styleGuide =
      options.style === 'all'
        ? '对每种命名类型（变量/函数/组件/文件/常量），同时提供 camelCase、PascalCase、snake_case 三种风格的候选'
        : `使用 ${options.style} 风格`;

    const prompt = `你是一名命名专家，擅长为代码元素起简洁、准确、符合惯例的名称。

## 需求描述
${description}

## 要求
- 语言/框架上下文：${options.lang}
- 命名风格：${styleGuide}
- 每种类型提供 ${count} 个候选，从最推荐到可接受排序
- 每个候选附简短说明（为什么选这个名字）

## 输出格式（Markdown 表格）

### 变量名
| 候选 | 风格 | 说明 |
|------|------|------|

### 函数/方法名
| 候选 | 风格 | 说明 |
|------|------|------|

### 类/组件名
| 候选 | 风格 | 说明 |
|------|------|------|

### 文件/模块名
| 候选 | 风格 | 说明 |
|------|------|------|

### 常量名
| 候选 | 风格 | 说明 |
|------|------|------|

最后给出你的 **最终推荐**（每类各一个，并说明理由）。`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ 命名建议提示词已复制到剪贴板\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── readme 命令（T10）──────────────────────────────────────────────────────
program
  .command('readme')
  .description('扫描项目结构，生成 README 起草提示词')
  .option('--template <tpl>', '模板类型：library | cli | webapp | api | monorepo', 'library')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    const cwd = process.cwd();

    // 读取 package.json
    const pkgPath = path.join(cwd, 'package.json');
    let pkgInfo = '';
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      pkgInfo = `\n## package.json 信息\n- name: ${pkgJson.name || 'N/A'}\n- version: ${pkgJson.version || 'N/A'}\n- description: ${pkgJson.description || 'N/A'}\n- scripts: ${Object.keys(pkgJson.scripts || {}).join(', ') || 'N/A'}\n`;
    }

    // 获取目录结构（2层）
    const treeResult = spawnSync('find', ['.', '-maxdepth', '2', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*', '-not', '-path', '*/dist/*'], {
      encoding: 'utf-8', cwd
    });
    const tree = (treeResult.stdout || '').trim().split('\n').slice(0, 60).join('\n');

    const templateGuide: Record<string, string> = {
      library: 'NPM 库 / SDK，包含：简介、安装、快速上手、API 文档、贡献指南',
      cli: 'CLI 工具，包含：简介、安装、命令列表（表格）、使用示例、配置说明',
      webapp: 'Web 应用，包含：简介、技术栈、本地开发、部署说明、截图区位占位',
      api: 'REST/GraphQL API 服务，包含：简介、接口列表、认证方式、部署',
      monorepo: 'Monorepo，包含：仓库结构、各包说明、开发工作流、发布流程',
    };

    const prompt = `你是一名技术写作者，请根据以下项目信息生成一份专业的 README.md。

## 项目类型
${options.template}（${templateGuide[options.template] || templateGuide['library']}）
${pkgInfo}
## 项目文件结构
\`\`\`
${tree}
\`\`\`

## 要求
1. 使用中文（技术术语保持英文）
2. 开头放 badges 占位（如 npm version / build status / license）
3. 结构清晰，每个 section 有实质内容（不要空占位）
4. 安装和使用示例务必给出真实的命令（根据 package.json 推断）
5. 末尾加 License section

请直接输出完整的 README.md 内容。`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ README 生成提示词已复制到剪贴板（${options.template} 模板）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── roast 命令（T11）───────────────────────────────────────────────────────
program
  .command('roast [file]')
  .description('以幽默吐槽方式 Review 代码（带 --pr 则 roast 当前 PR diff）')
  .option('--pr', '吐槽当前分支 PR diff')
  .option('--level <level>', '毒舌程度：mild（温和）| spicy（辛辣）| savage（毒舌）', 'spicy')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((file, options) => {
    let code = '';
    let codeLabel = '';

    if (options.pr) {
      if (!isGitRepo()) {
        console.error('❌ 当前目录不是 Git 仓库');
        process.exit(1);
      }
      const base = getDefaultBranch();
      code = truncateDiff(getBranchDiff(base), 6000);
      codeLabel = `PR diff（${base}...${getCurrentBranch()}）`;
    } else if (file) {
      const filePath = resolveFilePath(file);
      assertFileExists(filePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      code = content.length > 6000 ? content.slice(0, 6000) + '\n[...已截断...]' : content;
      codeLabel = file;
    } else {
      console.error('❌ 请提供文件路径或使用 --pr 吐槽当前 PR');
      process.exit(1);
    }

    const levelGuide: Record<string, string> = {
      mild: '温和友善，用轻松的玩笑指出问题，像好朋友之间的调侃',
      spicy: '辛辣直接，用夸张的比喻和反问揭露代码问题，但最终还是提出改进建议',
      savage: '毒舌模式全开，像脱口秀演员一样无情吐槽，但每个槽点都有实质的改进建议（最后给个鼓励）',
    };

    const prompt = `你是一名资深工程师，同时也是个擅长代码吐槽的脱口秀演员。请对以下代码进行幽默的 Roast Review。

## 毒舌程度
${levelGuide[options.level] || levelGuide['spicy']}

## 代码来源
${codeLabel}

## 代码 / Diff
\`\`\`
${code}
\`\`\`

## 输出要求
1. **开场白**（一句毒舌的总结）
2. **逐条吐槽**（每条格式：💀 [文件/函数名] 吐槽内容 → 实质改进建议）
3. **最佳槽点**（评选本次 Roast 的 MVP 代码片段，附详细解释）
4. **结语**（${options.level === 'savage' ? '狠狠骂完后给一句温暖鼓励' : '调侃中带着肯定'}）

注意：毒舌只是形式，每个问题都要有实质的技术建议，这不是人身攻击！`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ Roast Review 提示词已复制到剪贴板（${options.level} 模式）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── commit 命令（T01）──────────────────────────────────────────────────────
program
  .command('commit')
  .description('根据 git staged diff 生成 Commit Message 提示词，复制到剪贴板')
  .option('--type <type>', '强制指定 commit 类型（feat/fix/docs/refactor/test/chore 等）')
  .option('--emoji', '在 commit 类型前添加 Gitmoji')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    const stagedFiles = getStagedFiles();
    if (stagedFiles.length === 0) {
      console.error('❌ 暂存区为空，请先 git add 要提交的文件');
      process.exit(1);
    }

    const diff = truncateDiff(getStagedDiff(), 6000);
    const typeHint = options.type ? `\n\n**强制类型**：${options.type}` : '';
    const emojiHint = options.emoji
      ? '\n\n**输出格式**：在 type 前加 Gitmoji，例如 ✨ feat: ...'
      : '';

    const prompt = `你是一名经验丰富的工程师，请根据以下 Git staged diff 生成一条规范的 Commit Message。

## 要求
- 遵循 Conventional Commits 规范（type(scope): subject）
- type 可选：feat / fix / docs / style / refactor / perf / test / chore / ci / build
- subject 用中文或英文均可，简洁描述"做了什么"（≤50字）
- 如果改动涉及多个关注点，可附 body（每行一个要点）${typeHint}${emojiHint}

## 涉及文件
${stagedFiles.map((f) => `- ${f}`).join('\n')}

## Staged Diff
\`\`\`diff
${diff}
\`\`\`

请直接输出 Commit Message，不要额外解释。`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ Commit 提示词已复制到剪贴板（${stagedFiles.length} 个文件）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── review 命令（T02）──────────────────────────────────────────────────────
program
  .command('review')
  .description('对 git diff 执行 Code Review，生成提示词复制到剪贴板')
  .option('--focus <focus>', '重点关注方向（security/performance/style/logic）')
  .option('--pr', '审查当前分支相对默认分支的完整 PR diff')
  .option('--base <branch>', '与指定分支做对比（优先级高于 --pr）')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    let diff: string;
    let diffLabel: string;

    if (options.base) {
      diff = getBranchDiff(options.base);
      diffLabel = `分支对比：${options.base}...HEAD`;
    } else if (options.pr) {
      const base = getDefaultBranch();
      diff = getBranchDiff(base);
      diffLabel = `PR diff：${base}...HEAD`;
    } else {
      diff = getStagedDiff();
      if (!diff) {
        console.error('❌ 暂存区为空。请使用 --pr 或 --base <branch> 审查分支差异。');
        process.exit(1);
      }
      diffLabel = 'staged diff';
    }

    if (!diff) {
      console.error('❌ 未找到任何差异，无需 Review。');
      process.exit(1);
    }

    const focusHint = options.focus
      ? `\n\n**重点关注**：${options.focus}（请在该方向给出更深入的分析）`
      : '';

    const prompt = `你是一名资深工程师，请对以下代码变更进行系统性 Code Review。

## Review 维度
按以下顺序逐层分析，每个问题标注严重级别：
- 🔴 **Blocker**：必须修复才能合并（正确性 / 安全漏洞 / 数据丢失风险）
- 🟡 **Major**：强烈建议修复（性能 / 可维护性 / 明显不规范）
- 🟢 **Minor**：可选优化（代码风格 / 命名 / 小的可读性问题）${focusHint}

## 变更来源
${diffLabel}（当前分支：${getCurrentBranch()}）

## Diff
\`\`\`diff
${truncateDiff(diff, 8000)}
\`\`\`

## 输出格式
1. **总体评价**（1-2句）
2. **问题列表**（按 Blocker → Major → Minor 排列，每条格式：\`[文件:行号] 级别：描述 → 建议\`）
3. **值得肯定的设计**（若有）
4. **Review 结论**（通过 / 需修改后通过 / 需重大修改）`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ Code Review 提示词已复制到剪贴板（${diffLabel}）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── pr 命令（T03）───────────────────────────────────────────────────────────
program
  .command('pr')
  .description('根据分支 diff 生成 PR 描述提示词')
  .option('--base <branch>', '对比的目标分支（默认自动检测 main/master）')
  .option('--out <file>', '将提示词写入文件（如 PR_DRAFT.md）')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    const base = options.base || getDefaultBranch();
    const currentBranch = getCurrentBranch();

    if (currentBranch === base) {
      console.error(`❌ 当前已在 ${base} 分支，请切换到功能分支后再生成 PR 描述。`);
      process.exit(1);
    }

    const diff = getBranchDiff(base);
    if (!diff) {
      console.error(`❌ 与 ${base} 分支相比没有差异，无需创建 PR。`);
      process.exit(1);
    }

    const prompt = `你是一名经验丰富的工程师，请根据以下 Git diff 生成一份规范的 Pull Request 描述。

## PR 信息
- **当前分支**：${currentBranch}
- **目标分支**：${base}

## 要求
生成包含以下结构的 PR 描述（Markdown 格式）：

### ✨ 变更概述
（1-3 句话，说明这个 PR 做了什么）

### 📋 变更详情
（分点列出主要改动）

### 🧪 测试说明
（如何验证这些改动，包括手动测试步骤）

### 🔗 关联 Issue
（如有，填写 "Closes #xxx" 或 "N/A"）

### ⚠️ 注意事项
（Reviewer 需要特别关注的地方，或部署注意事项）

## Diff（${base}...${currentBranch}）
\`\`\`diff
${truncateDiff(diff, 8000)}
\`\`\`

请直接输出 PR 描述内容，使用 Markdown 格式，不要额外解释。`;

    if (options.out) {
      const outPath = path.resolve(process.cwd(), options.out);
      fs.writeFileSync(outPath, prompt, 'utf-8');
      console.log(`\n✅ PR 提示词已写入：${outPath}\n`);
    } else if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ PR 描述提示词已复制到剪贴板（${base}...${currentBranch}）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── standup 命令（T04）─────────────────────────────────────────────────────
program
  .command('standup')
  .description('根据最近 24h 的 git log 生成日报 / 站会稿')
  .option('--since <time>', '查询时间范围（默认 "24 hours ago"）', '24 hours ago')
  .option('--author <author>', '只统计指定作者的提交（默认当前 git user）')
  .option(
    '--format <format>',
    '输出格式：standup（站会稿）| daily（日报）| brief（一句话）',
    'standup'
  )
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    // 默认使用 git config 中的 user.name
    const authorResult = spawnSync('git', ['config', 'user.name'], { encoding: 'utf-8' });
    const author = options.author || (authorResult.stdout || '').trim() || undefined;

    const log = getCommitLogSince(options.since, author);
    if (!log) {
      console.log(`\n⚠️  在 "${options.since}" 内未找到任何提交记录。\n`);
      process.exit(0);
    }

    const formatGuide: Record<string, string> = {
      standup: `输出为站会发言稿，包含：
1. **昨日完成**（根据 commit log 推断）
2. **今日计划**（根据 commit 趋势合理推断 1-3 条）
3. **阻塞 / 风险**（如有，否则填"无"）
格式简洁，适合口头朗读（60-120字）`,
      daily: `输出为日报，包含：
1. **完成事项**（分条）
2. **遗留 / 待处理**
3. **明日计划**
适合发送到工作群`,
      brief: `用一句话总结今天的主要工作（≤30字）`,
    };

    const guide = formatGuide[options.format] || formatGuide['standup'];

    const prompt = `你是一名工程师助手，请根据以下 Git 提交记录，生成${options.format === 'standup' ? '站会发言稿' : options.format === 'daily' ? '日报' : '工作简报'}。

## 提交记录（${options.since} 至今）
\`\`\`
${log}
\`\`\`

## 要求
${guide}

请直接输出内容，不要解释格式。`;

    if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ 站会 / 日报提示词已复制到剪贴板\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── changelog 命令（T05）───────────────────────────────────────────────────
program
  .command('changelog')
  .description('根据 tag 区间的 commit log 生成 CHANGELOG 提示词')
  .option('--from <tag>', '起始 tag（默认最新 tag）')
  .option('--to <ref>', '结束 ref（默认 HEAD）', 'HEAD')
  .option('--out <file>', '将提示词写入文件')
  .option('--append', '追加到 --out 文件而非覆盖')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    const from = options.from || getLatestTag();
    if (!from) {
      console.error('❌ 未找到任何 tag，请使用 --from <tag> 指定起始点。');
      process.exit(1);
    }

    const tags = getTags();
    const log = getCommitRange(from, options.to);
    if (!log) {
      console.error(`❌ ${from}..${options.to} 之间没有新的提交。`);
      process.exit(1);
    }

    const tagsInfo = tags.length > 0 ? `最近 tag：${tags.slice(0, 5).join(', ')}` : '';

    const prompt = `你是一名技术写作者，请根据以下 Git commit log 生成规范的 CHANGELOG 内容。

## 版本信息
- **起始**：${from}
- **结束**：${options.to}
${tagsInfo ? `- **${tagsInfo}**` : ''}

## 要求
输出格式（Markdown）：
\`\`\`
## [版本号] - YYYY-MM-DD

### ✨ Features
- commit subject（去掉 feat: 前缀）

### 🐛 Bug Fixes
- commit subject（去掉 fix: 前缀）

### 📝 Documentation
- ...

### ♻️ Refactor
- ...

### 🔧 Chore
- ...
\`\`\`

规则：
1. 按 Conventional Commits type 分类
2. 跳过 merge commit 和无意义的 chore（如 bump version）
3. 语言与 commit message 保持一致
4. 如果 commit 没有规范 type 前缀，根据内容判断分类

## Commit Log（${from}..${options.to}）
\`\`\`
${log}
\`\`\`

请直接输出 CHANGELOG 内容，不要额外说明。`;

    if (options.out) {
      const outPath = path.resolve(process.cwd(), options.out);
      if (options.append && fs.existsSync(outPath)) {
        const existing = fs.readFileSync(outPath, 'utf-8');
        fs.writeFileSync(outPath, prompt + '\n\n---\n\n' + existing, 'utf-8');
      } else {
        fs.writeFileSync(outPath, prompt, 'utf-8');
      }
      console.log(`\n✅ CHANGELOG 提示词已写入：${outPath}\n`);
    } else if (options.copy !== false) {
      const ok = copyToClipboard(prompt);
      console.log(`\n✅ CHANGELOG 提示词已复制到剪贴板（${from}..${options.to}）\n`);
      if (!ok) console.log(prompt);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── oncall 命令（T13）──────────────────────────────────────────────────────
program
  .command('oncall')
  .description('启动故障响应工作流，生成事故排查提示词')
  .option('--severity <level>', '严重程度：P0（全站不可用）| P1（核心功能受损）| P2（局部影响）', 'P1')
  .option('-d, --desc <description>', '故障描述（现象、影响范围、触发时间）')
  .option('--postmortem', '生成事后复盘报告提示词（事故已解决后使用）')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    const desc = options.desc || '（请描述故障现象、影响用户范围和触发时间）';
    const severity = options.severity || 'P1';

    const severityGuide: Record<string, string> = {
      P0: '全站不可用 / 核心服务宕机，所有用户受影响，需立即处理',
      P1: '核心功能受损（如登录、支付、核心 API），部分用户受影响',
      P2: '非核心功能异常，影响范围有限，可在当天内处理',
    };

    if (options.postmortem) {
      const prompt = `你是一名 SRE 工程师，请帮我撰写事后复盘报告（Postmortem）。

## 事故信息
- **严重程度**：${severity}（${severityGuide[severity] || '未知'}）
- **故障描述**：${desc}

## 复盘报告结构

### 1. 事故摘要
（一段话描述：发生了什么、影响了什么、持续多久）

### 2. 事故时间线
| 时间 | 事件 |
|------|------|
|      |      |

### 3. 根本原因分析（5 Why）
- Why 1：为什么故障发生？
- Why 2：...
- Why 3：...
- Why 4：...
- Why 5：根本原因

### 4. 影响评估
- 受影响用户数 / 请求数
- 业务损失（可量化的部分）
- SLA 影响

### 5. 解决措施
- **临时措施**（已执行）：
- **永久修复**（已执行或计划）：

### 6. 改进措施（Action Items）
| 措施 | 负责人 | 截止日期 | 优先级 |
|------|--------|----------|--------|

### 7. 经验教训

请根据上述信息，帮我补全这份复盘报告，对空白处提供建议填写方向。`;

      if (options.copy !== false) {
        copyToClipboard(prompt);
        console.log(`\n✅ 复盘报告提示词已复制到剪贴板\n`);
      } else {
        console.log('\n' + prompt + '\n');
      }
      return;
    }

    const prompt = `你是一名经验丰富的 SRE / On-Call 工程师，正在处理一起生产故障。

## 故障信息
- **严重程度**：${severity}（${severityGuide[severity] || '未知'}）
- **当前状态**：正在响应中

## 故障现象
${desc}

## 请按照以下框架协助我进行故障排查：

### Phase 1：快速评估（2 分钟内）
1. **现象确认**：故障现象是否与描述一致？需要补充哪些关键信息？
2. **影响范围**：受影响的服务 / 用户 / 区域
3. **初步假设**：最可能的 3 个根因（按概率排序）

### Phase 2：假设验证（逐一排查）
对每个假设：
- 验证方法（命令 / 指标 / 日志查询）
- 期望结果 vs 实际结果
- 结论（排除 / 确认）

### Phase 3：解决方案
- **立即止血**（最快恢复服务的临时措施）
- **根治方案**（解决根本原因）
- **预防措施**（防止复现）

### Phase 4：复盘准备
- 关键时间节点记录
- 待填写的 Postmortem 模板框架

请开始评估，首先告诉我需要哪些关键信息来锁定根因。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ 故障排查提示词已复制到剪贴板（${severity}）\n`);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── schedule 命令（T14）────────────────────────────────────────────────────
const scheduleCmd = program
  .command('schedule')
  .description('定时任务管理：将 ethan 命令加入 crontab（add/list/remove）');

scheduleCmd
  .command('add <command>')
  .description('将 ethan 命令添加到 crontab（如：ethan standup --no-copy）')
  .option('--cron <expr>', 'cron 表达式（默认：每天早上 9:00）', '0 9 * * 1-5')
  .action((command, options) => {
    if (process.platform === 'win32') {
      console.error('❌ schedule 命令暂不支持 Windows（请使用任务计划程序）');
      process.exit(1);
    }

    const ethanBin = process.execPath.replace('node', '') + 'ethan';
    const fullCmd = `ethan ${command}`;
    const cronLine = `${options.cron} ${fullCmd} # ethan-schedule`;

    // 读取现有 crontab
    const existing = spawnSync('crontab', ['-l'], { encoding: 'utf-8' });
    const currentCron = existing.status === 0 ? (existing.stdout || '') : '';

    if (currentCron.includes(fullCmd)) {
      console.log(`\n⚠️  已存在相同的定时任务：${fullCmd}\n`);
      process.exit(0);
    }

    const newCron = (currentCron.trimEnd() + '\n' + cronLine + '\n').trimStart();
    const result = spawnSync('crontab', ['-'], { input: newCron, encoding: 'utf-8' });

    if (result.status !== 0) {
      console.error(`❌ 添加 crontab 失败：${result.stderr}`);
      process.exit(1);
    }

    console.log(`\n✅ 已添加定时任务`);
    console.log(`   时间：${options.cron}  （周一至周五 09:00）`);
    console.log(`   命令：${fullCmd}`);
    console.log(`\n💡 使用 ethan schedule list 查看所有任务\n`);
    void ethanBin;
  });

scheduleCmd
  .command('list')
  .description('列出所有 ethan 定时任务')
  .action(() => {
    if (process.platform === 'win32') {
      console.error('❌ schedule 命令暂不支持 Windows');
      process.exit(1);
    }
    const result = spawnSync('crontab', ['-l'], { encoding: 'utf-8' });
    const lines = (result.stdout || '').split('\n').filter((l) => l.includes('# ethan-schedule'));
    if (lines.length === 0) {
      console.log('\n📋 暂无 ethan 定时任务。使用 ethan schedule add 添加。\n');
      return;
    }
    console.log(`\n📋 ethan 定时任务（${lines.length} 个）\n`);
    lines.forEach((l, i) => {
      const parts = l.replace('# ethan-schedule', '').trim().split(/\s+/);
      const cronExpr = parts.slice(0, 5).join(' ');
      const cmd = parts.slice(5).join(' ');
      console.log(`  ${i + 1}. [${cronExpr}]  ${cmd}`);
    });
    console.log('');
  });

scheduleCmd
  .command('remove <command>')
  .description('移除 ethan 定时任务（匹配命令关键字）')
  .action((command) => {
    if (process.platform === 'win32') {
      console.error('❌ schedule 命令暂不支持 Windows');
      process.exit(1);
    }
    const result = spawnSync('crontab', ['-l'], { encoding: 'utf-8' });
    const currentCron = result.status === 0 ? (result.stdout || '') : '';

    const newCron = currentCron
      .split('\n')
      .filter((l) => !(l.includes(command) && l.includes('# ethan-schedule')))
      .join('\n');

    if (newCron === currentCron) {
      console.log(`\n⚠️  未找到匹配的定时任务：${command}\n`);
      return;
    }

    const writeResult = spawnSync('crontab', ['-'], { input: newCron, encoding: 'utf-8' });
    if (writeResult.status !== 0) {
      console.error(`❌ 移除失败：${writeResult.stderr}`);
      process.exit(1);
    }
    console.log(`\n✅ 已移除包含 "${command}" 的定时任务\n`);
  });

// ─── init --hooks 命令（T15）────────────────────────────────────────────────
// init 命令已存在，在此添加 --hooks 支持（通过修改现有 init action）
// 由于无法直接 patch 已注册的 action，以独立命令方式实现 hooks 管理
const hooksCmd = program
  .command('hooks')
  .description('Git Hook 集成：将 ethan 命令注入到 git hooks（install/remove/list）');

hooksCmd
  .command('install')
  .description('安装 ethan git hooks（pre-commit / commit-msg / post-merge）')
  .option('--pre-commit', '在 pre-commit 时运行 ethan scan（扫描代码健康）')
  .option('--commit-msg', '在 commit-msg 时提示 ethan commit（生成 commit 建议）')
  .option('--post-merge', '在 post-merge 时运行 ethan standup（更新站会稿）')
  .option('--all', '安装全部三个 hooks')
  .action((options) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }

    const gitDir = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf-8' }).stdout.trim();
    const hooksDir = path.join(process.cwd(), gitDir, 'hooks');

    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

    const installed: string[] = [];

    if (options.all || options.preCommit) {
      const hookPath = path.join(hooksDir, 'pre-commit');
      const hookContent = `#!/bin/sh
# ethan-hook: pre-commit
# 运行 ethan scan 检查代码健康（仅警告，不阻止提交）
if command -v ethan &> /dev/null; then
  ethan scan --no-copy 2>&1 | grep -E "⚠️|❌" || true
fi
`;
      fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
      installed.push('pre-commit');
    }

    if (options.all || options.commitMsg) {
      const hookPath = path.join(hooksDir, 'commit-msg');
      const hookContent = `#!/bin/sh
# ethan-hook: commit-msg
# 如果 commit message 太短（<10字符），提示使用 ethan commit
MSG=$(cat "$1")
if [ \${#MSG} -lt 10 ]; then
  echo "⚠️  Commit message 太短（<10字符）。提示：运行 'ethan commit' 生成规范的 Commit Message"
fi
exit 0
`;
      fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
      installed.push('commit-msg');
    }

    if (options.all || options.postMerge) {
      const hookPath = path.join(hooksDir, 'post-merge');
      const hookContent = `#!/bin/sh
# ethan-hook: post-merge
# merge 后自动提示生成站会稿
if command -v ethan &> /dev/null; then
  echo "\\n💡 已完成 merge，运行 'ethan standup' 生成站会稿"
fi
`;
      fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
      installed.push('post-merge');
    }

    if (installed.length === 0) {
      console.log('\n💡 请指定要安装的 hook：--pre-commit | --commit-msg | --post-merge | --all\n');
      process.exit(0);
    }

    console.log(`\n✅ 已安装 ${installed.length} 个 git hook：${installed.join(', ')}`);
    console.log(`   路径：${hooksDir}\n`);
  });

hooksCmd
  .command('list')
  .description('列出当前项目已安装的 ethan git hooks')
  .action(() => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }
    const gitDir = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf-8' }).stdout.trim();
    const hooksDir = path.join(process.cwd(), gitDir, 'hooks');
    const hookNames = ['pre-commit', 'commit-msg', 'post-merge', 'pre-push'];

    console.log('\n🪝 ethan git hooks\n');
    for (const hook of hookNames) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        const isEthan = content.includes('ethan-hook');
        console.log(`  ${isEthan ? '✅' : '⚪'} ${hook}${isEthan ? '  [ethan]' : ''}`);
      } else {
        console.log(`  ⬜ ${hook}  （未安装）`);
      }
    }
    console.log('');
  });

hooksCmd
  .command('remove [hook]')
  .description('移除 ethan git hooks（不指定则移除所有）')
  .action((hook) => {
    if (!isGitRepo()) {
      console.error('❌ 当前目录不是 Git 仓库');
      process.exit(1);
    }
    const gitDir = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf-8' }).stdout.trim();
    const hooksDir = path.join(process.cwd(), gitDir, 'hooks');
    const targets = hook ? [hook] : ['pre-commit', 'commit-msg', 'post-merge'];
    const removed: string[] = [];

    for (const h of targets) {
      const hookPath = path.join(hooksDir, h);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        if (content.includes('ethan-hook')) {
          fs.unlinkSync(hookPath);
          removed.push(h);
        }
      }
    }

    if (removed.length === 0) {
      console.log('\n⚠️  未找到 ethan git hooks\n');
    } else {
      console.log(`\n✅ 已移除 ${removed.length} 个 hook：${removed.join(', ')}\n`);
    }
  });

// ─── memory 命令（T16 Skill Memory）────────────────────────────────────────
// 自动归档工作流输出，支持搜索、展示、导出
// 存储位置：~/.ethan-memory/ (全局) 或 .ethan/memory/ (项目级)

const GLOBAL_MEMORY_DIR = path.join(os.homedir(), '.ethan-memory');

interface MemoryEntry {
  id: string;
  type: 'workflow' | 'skill' | 'manual';
  skillId?: string;
  pipelineId?: string;
  title: string;
  content: string;
  tags: string[];
  project?: string;
  createdAt: string;
}

function getMemoryDir(global: boolean, cwd?: string): string {
  return global ? GLOBAL_MEMORY_DIR : path.join(cwd || process.cwd(), '.ethan', 'memory');
}

function loadMemoryEntries(dir: string): MemoryEntry[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as MemoryEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is MemoryEntry => e !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function saveMemoryEntry(entry: MemoryEntry, dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${entry.id}.json`);
  fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
}

/** 归档工作流会话 summary 到 memory（workflow done 后自动调用） */
function archiveWorkflowToMemory(
  sessionId: string,
  skillId: string,
  pipelineName: string,
  summary: string,
  cwd: string
): void {
  const dir = getMemoryDir(false, cwd);
  const entry: MemoryEntry = {
    id: `${Date.now().toString(36)}-${skillId}`,
    type: 'workflow',
    skillId,
    pipelineId: pipelineName,
    title: `[${pipelineName}] ${skillId} — ${summary.slice(0, 60)}`,
    content: summary,
    tags: [skillId, pipelineName],
    project: path.basename(cwd),
    createdAt: new Date().toISOString(),
  };
  saveMemoryEntry(entry, dir);
}

const memoryCmd = program.command('memory').description('Skill Memory：归档、搜索、展示 AI 工作产出');

memoryCmd
  .command('add <content>')
  .description('手动添加一条记忆（内容支持多行，用引号包裹）')
  .option('--title <title>', '记忆标题')
  .option('--tags <tags>', '标签（逗号分隔）')
  .option('--global', '存至全局 ~/.ethan-memory/（默认存项目级 .ethan/memory/）')
  .action((content, options) => {
    const dir = getMemoryDir(!!options.global);
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
    const entry: MemoryEntry = {
      id: Date.now().toString(36),
      type: 'manual',
      title: options.title || content.slice(0, 60),
      content,
      tags,
      project: path.basename(process.cwd()),
      createdAt: new Date().toISOString(),
    };
    saveMemoryEntry(entry, dir);
    console.log(`\n✅ 记忆已保存：${entry.title}\n   ID: ${entry.id}\n`);
  });

memoryCmd
  .command('search <keyword>')
  .description('在记忆库中搜索关键词（标题 + 内容 + 标签）')
  .option('--global', '搜索全局记忆库')
  .option('--tag <tag>', '按标签过滤')
  .option('-n, --limit <n>', '最多显示 N 条', '10')
  .action((keyword, options) => {
    const dir = getMemoryDir(!!options.global);
    const entries = loadMemoryEntries(dir);
    const kw = keyword.toLowerCase();
    const limit = parseInt(options.limit, 10) || 10;

    let results = entries.filter((e) => {
      const matchKw =
        e.title.toLowerCase().includes(kw) ||
        e.content.toLowerCase().includes(kw) ||
        e.tags.some((t) => t.toLowerCase().includes(kw));
      const matchTag = options.tag ? e.tags.includes(options.tag) : true;
      return matchKw && matchTag;
    });

    results = results.slice(0, limit);

    if (results.length === 0) {
      console.log(`\n🔍 未找到匹配 "${keyword}" 的记忆\n`);
      return;
    }

    console.log(`\n🔍 找到 ${results.length} 条记忆（关键词："${keyword}"）\n`);
    console.log('─'.repeat(60));
    for (const e of results) {
      const preview = e.content.length > 100 ? e.content.slice(0, 100) + '…' : e.content;
      console.log(`\n  📌 ${e.title}`);
      console.log(`     ID: ${e.id}  |  ${e.createdAt.slice(0, 10)}  |  标签：${e.tags.join(', ') || '无'}`);
      console.log(`     ${preview}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log(`\n💡 用 ethan memory show <id> 查看完整内容\n`);
  });

memoryCmd
  .command('show <id>')
  .description('展示一条记忆的完整内容')
  .option('--global', '从全局记忆库读取')
  .option('--no-copy', '不复制到剪贴板')
  .action((id, options) => {
    const dir = getMemoryDir(!!options.global);
    const entries = loadMemoryEntries(dir);
    const entry = entries.find((e) => e.id === id || e.id.startsWith(id));

    if (!entry) {
      console.error(`❌ 未找到 ID 为 "${id}" 的记忆`);
      process.exit(1);
    }

    console.log(`\n📖 ${entry.title}`);
    console.log(`   类型：${entry.type}  |  ${entry.createdAt.slice(0, 19).replace('T', ' ')}`);
    if (entry.tags.length > 0) console.log(`   标签：${entry.tags.join(', ')}`);
    console.log('\n' + '─'.repeat(60) + '\n');
    console.log(entry.content);
    console.log('\n' + '─'.repeat(60));

    if (options.copy !== false) {
      copyToClipboard(entry.content);
      console.log('\n✅ 内容已复制到剪贴板\n');
    }
  });

memoryCmd
  .command('list')
  .description('列出最近的记忆条目')
  .option('--global', '列出全局记忆库')
  .option('-n, --limit <n>', '显示条数', '20')
  .option('--tag <tag>', '按标签过滤')
  .action((options) => {
    const dir = getMemoryDir(!!options.global);
    let entries = loadMemoryEntries(dir);
    if (options.tag) entries = entries.filter((e) => e.tags.includes(options.tag));
    entries = entries.slice(0, parseInt(options.limit, 10) || 20);

    if (entries.length === 0) {
      console.log('\n📋 记忆库为空。使用 ethan memory add 或工作流自动归档。\n');
      return;
    }

    console.log(`\n🧠 Skill Memory（${options.global ? '全局' : '项目'}，${entries.length} 条）\n`);
    console.log('─'.repeat(60));
    for (const e of entries) {
      const icon = e.type === 'workflow' ? '🔄' : e.type === 'skill' ? '⚡' : '📝';
      console.log(`  ${icon} [${e.id}]  ${e.title.slice(0, 55)}`);
      console.log(`       ${e.createdAt.slice(0, 10)}  ${e.tags.join(' #') ? '#' + e.tags.join(' #') : ''}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log('\n用 ethan memory search <keyword> 搜索，ethan memory show <id> 查看详情\n');
  });

memoryCmd
  .command('export')
  .description('导出记忆库为 Markdown 文件')
  .option('--global', '导出全局记忆库')
  .option('--out <file>', '输出文件路径', 'ethan-memory-export.md')
  .option('--tag <tag>', '只导出指定标签')
  .action((options) => {
    const dir = getMemoryDir(!!options.global);
    let entries = loadMemoryEntries(dir);
    if (options.tag) entries = entries.filter((e) => e.tags.includes(options.tag));

    if (entries.length === 0) {
      console.log('\n📋 记忆库为空，无需导出。\n');
      return;
    }

    const lines: string[] = [
      `# Ethan Memory Export`,
      ``,
      `- **导出时间**：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      `- **条目数**：${entries.length}`,
      `- **范围**：${options.global ? '全局' : '项目级'}`,
      ``,
      `---`,
      ``,
    ];

    for (const e of entries) {
      lines.push(`## ${e.title}`);
      lines.push(``);
      lines.push(`- **ID**: \`${e.id}\``);
      lines.push(`- **类型**: ${e.type}`);
      lines.push(`- **时间**: ${e.createdAt.slice(0, 10)}`);
      if (e.tags.length > 0) lines.push(`- **标签**: ${e.tags.map((t) => `\`${t}\``).join(' ')}`);
      lines.push(``);
      lines.push(e.content);
      lines.push(``);
      lines.push(`---`);
      lines.push(``);
    }

    const outPath = path.resolve(process.cwd(), options.out);
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`\n✅ 已导出 ${entries.length} 条记忆到：${outPath}\n`);
  });

memoryCmd
  .command('remove <id>')
  .description('删除一条记忆')
  .option('--global', '从全局记忆库删除')
  .action((id, options) => {
    const dir = getMemoryDir(!!options.global);
    const entries = loadMemoryEntries(dir);
    const entry = entries.find((e) => e.id === id || e.id.startsWith(id));

    if (!entry) {
      console.error(`❌ 未找到 ID 为 "${id}" 的记忆`);
      process.exit(1);
    }

    const filePath = path.join(dir, `${entry.id}.json`);
    fs.unlinkSync(filePath);
    console.log(`\n✅ 已删除：${entry.title}\n`);
  });

// ─── estimate 命令（T17 Estimation）────────────────────────────────────────
program
  .command('estimate')
  .description('任务工时估算：用三点估算法生成结构化评估提示词')
  .option('-t, --task <task>', '任务描述')
  .option('--style <style>', '估算方式：story-points | hours | t-shirt（S/M/L/XL）', 'hours')
  .option('--team <size>', '团队规模（影响并行度评估）', '1')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action((options) => {
    const task = options.task || '（请描述要估算的任务或功能）';
    const style = options.style || 'hours';

    const styleGuide: Record<string, string> = {
      hours: '用工时（人天）估算，分 乐观/标准/悲观 三个场景，给出加权平均（PERT 公式：(O + 4M + P) / 6）',
      'story-points': '用故事点（Fibonacci 数列：1/2/3/5/8/13/21）估算，基于复杂度和不确定性',
      't-shirt': '用 T 恤尺码（XS / S / M / L / XL / XXL）给出快速相对估算，适合 backlog 梳理',
    };

    const prompt = `你是一名有丰富经验的工程估算专家，请对以下任务进行结构化工时评估。

## 任务描述
${task}

## 团队信息
- 团队规模：${options.team} 人
- 估算单位：${styleGuide[style] || styleGuide['hours']}

## 请按以下结构输出评估结果：

### 1. 任务拆解（Work Breakdown Structure）
将任务分解为子任务，每个子任务单独估算

### 2. 风险识别
| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|

### 3. 估算结果
| 子任务 | 乐观 | 标准 | 悲观 | 加权平均 |
|--------|------|------|------|----------|
| ...    |      |      |      |          |
| **合计** |    |      |      | **X.X 天** |

### 4. 关键假设
（哪些条件成立，估算才有效）

### 5. 建议缓冲
（基于风险，建议增加 X% 缓冲，总估算约 Y 天）

### 6. 置信区间
（80% 置信度范围：X - Y 天）

请给出完整评估，并在最后说明最大不确定因素是什么。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ 估算提示词已复制到剪贴板（${style} 模式）\n`);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── retro 命令（T17 Retrospective）────────────────────────────────────────
program
  .command('retro')
  .description('迭代复盘：生成回顾会议提示词 / 总结报告')
  .option('--sprint <name>', '迭代/Sprint 名称或编号')
  .option('--format <fmt>', '格式：4l（4L 回顾）| starfish（海星）| mad-sad-glad | start-stop-continue', '4l')
  .option('--from-workflow', '从当前工作流会话读取上下文（自动填充完成内容）')
  .option('--no-copy', '不复制到剪贴板，直接打印')
  .action(async (options) => {
    const sprint = options.sprint || '本次迭代';
    const fmt = options.format || '4l';

    let workflowContext = '';
    if (options.fromWorkflow) {
      const { loadSession, calcProgress } = await import('../workflow/state');
      const session = loadSession(process.cwd());
      if (session) {
        const progress = calcProgress(session);
        const doneSteps = session.steps
          .filter((s) => s.status === 'done')
          .map((s) => `- ${s.skillId}：${s.summary || '（无摘要）'}`)
          .join('\n');
        workflowContext = `\n## 工作流上下文\n- Pipeline：${session.pipelineName}\n- 进度：${progress}%\n- 已完成步骤：\n${doneSteps}\n`;
      }
    }

    const formatGuide: Record<string, string> = {
      '4l': `使用 **4L 回顾框架**：
- **Liked（喜欢的）**：哪些做得好、值得保留？
- **Learned（学到的）**：获得了哪些新知识或经验？
- **Lacked（缺少的）**：哪些该有但没有的？
- **Longed For（期望的）**：希望在下个迭代中改进的？`,
      starfish: `使用 **海星回顾框架**：
- **Keep（继续）**：效果好，继续做
- **Less（减少）**：有一定效果，但可以少做
- **More（增加）**：效果好，应该多做
- **Start（开始）**：还没做但应该开始
- **Stop（停止）**：没有效果，应该停止`,
      'mad-sad-glad': `使用 **Mad/Sad/Glad 情绪回顾**：
- **Mad（令人烦恼的）**：让团队沮丧或愤怒的事情
- **Sad（令人遗憾的）**：可以更好但没做到的
- **Glad（令人开心的）**：做得好、值得庆祝的`,
      'start-stop-continue': `使用 **Start/Stop/Continue 框架**：
- **Start**：应该开始做的新事情
- **Stop**：应该停止的无效做法
- **Continue**：应该继续保持的做法`,
    };

    const guide = formatGuide[fmt] || formatGuide['4l'];

    const prompt = `你是一名敏捷教练，请帮助团队对"${sprint}"进行回顾总结。
${workflowContext}
## 回顾框架

${guide}

## 请输出以下内容：

### 1. 回顾会议引导提问
（针对本框架各维度，给出 3-5 个引导团队讨论的开放性问题）

### 2. 回顾报告模板
（按框架结构，提供可填写的模板，每项有举例说明）

### 3. 行动项建议格式
| 问题 | 根因 | 行动项 | 负责人 | 截止 |
|------|------|--------|--------|------|

### 4. 下次迭代目标（OKR 式）
- **目标（O）**：...
- **关键结果（KR）**：...

请以鼓励、积极的基调引导回顾，关注改进而非批评。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ 迭代复盘提示词已复制到剪贴板（${fmt} 框架）\n`);
    } else {
      console.log('\n' + prompt + '\n');
    }
  });

// ─── stats 扩展（T22 Stats Leaderboard）────────────────────────────────────
// 扩展 stats 命令为 stats 子命令组，添加 leaderboard 和 streak 功能

interface StatsData {
  usage: Record<string, number>;
  streak: {
    current: number;
    best: number;
    lastDate: string;
  };
  dailyLog: Record<string, string[]>; // date → skill ids used
  ratings?: Record<string, number[]>; // skillId → [1,4,5,3,...] (1-5)
}

function readStatsV2(): StatsData {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      // 向上兼容旧格式（纯 Record<string, number>）
      if (raw.usage) return raw as StatsData;
      return { usage: raw as Record<string, number>, streak: { current: 0, best: 0, lastDate: '' }, dailyLog: {} };
    }
  } catch { /* ignore */ }
  return { usage: {}, streak: { current: 0, best: 0, lastDate: '' }, dailyLog: {} };
}

function writeStatsV2(data: StatsData): void {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

/** 记录使用并更新连续使用天数 */
function trackUsageWithStreak(skillId: string): void {
  const data = readStatsV2();
  const today = new Date().toISOString().slice(0, 10);

  // 使用次数
  data.usage[skillId] = (data.usage[skillId] || 0) + 1;

  // 每日日志
  if (!data.dailyLog[today]) data.dailyLog[today] = [];
  if (!data.dailyLog[today].includes(skillId)) data.dailyLog[today].push(skillId);

  // Streak 计算
  const lastDate = data.streak.lastDate;
  if (lastDate === today) {
    // 当天已经记录，无需更新 streak
  } else if (lastDate === '') {
    data.streak.current = 1;
    data.streak.best = 1;
    data.streak.lastDate = today;
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastDate === yesterday) {
      data.streak.current += 1;
      data.streak.best = Math.max(data.streak.best, data.streak.current);
    } else {
      // 断签
      data.streak.current = 1;
    }
    data.streak.lastDate = today;
  }

  writeStatsV2(data);
}

const statsCmd = program.command('stats').description('查看 Skill 使用频次统计和连续使用天数');

statsCmd
  .command('show')
  .description('显示 ASCII 条形图统计（默认命令）')
  .option('--reset', '清空统计数据')
  .action((options) => {
    if (options.reset) {
      fs.writeFileSync(STATS_FILE, JSON.stringify({ usage: {}, streak: { current: 0, best: 0, lastDate: '' }, dailyLog: {} }, null, 2), 'utf-8');
      console.log('\n✅ 统计数据已清空\n');
      return;
    }

    const data = readStatsV2();
    const usage = data.usage;

    if (Object.keys(usage).length === 0) {
      console.log('\n📊 暂无使用记录。运行任意 Skill 后会自动记录。\n');
      return;
    }

    const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];

    console.log('\n📊 Skill 使用统计\n');
    console.log('─'.repeat(60));
    for (const [id, count] of sorted) {
      const bar = '█'.repeat(Math.round((count / max) * 30));
      const skill = ALL_SKILLS.find((s) => s.id === id);
      const label = skill ? `${skill.name}` : id;
      console.log(`  ${label.padEnd(14)}  ${bar.padEnd(30)} ${count}`);
    }
    console.log('─'.repeat(60));
    console.log(`\n  🔥 连续使用：${data.streak.current} 天  |  最长连续：${data.streak.best} 天\n`);
  });

statsCmd
  .command('leaderboard')
  .description('显示使用排行榜 + 连续天数 + 日历热图')
  .option('--top <n>', '显示前 N 名', '5')
  .action((options) => {
    const data = readStatsV2();
    const usage = data.usage;
    const top = parseInt(options.top, 10) || 5;

    console.log('\n🏆 Ethan Leaderboard\n');
    console.log('─'.repeat(60));

    // ── 排行榜 ──────────────────────────────────────────────────────────────
    const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, top);
    const medals = ['🥇', '🥈', '🥉', '4️⃣ ', '5️⃣ '];
    if (sorted.length === 0) {
      console.log('  暂无记录\n');
    } else {
      console.log('\n  Top Skills\n');
      sorted.forEach(([id, count], i) => {
        const skill = ALL_SKILLS.find((s) => s.id === id);
        const name = skill ? skill.name : id;
        const bar = '▰'.repeat(Math.min(count, 20));
        console.log(`  ${medals[i] || `${i + 1}. `}  ${name.padEnd(12)}  ${bar} ${count}次`);
      });
    }

    // ── 连续天数 ────────────────────────────────────────────────────────────
    console.log('\n  Streak\n');
    const streakBar = '🔥'.repeat(Math.min(data.streak.current, 7));
    console.log(`  当前：${data.streak.current} 天  ${streakBar}`);
    console.log(`  最长：${data.streak.best} 天`);
    if (data.streak.lastDate) console.log(`  最后使用：${data.streak.lastDate}`);

    // ── 近 7 天热图 ─────────────────────────────────────────────────────────
    console.log('\n  近 7 天活跃度\n');
    const today = new Date();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const heatRow = days
      .map((d) => {
        const count = (data.dailyLog[d] || []).length;
        if (count === 0) return '⬜';
        if (count === 1) return '🟩';
        if (count <= 3) return '🟨';
        return '🟥';
      })
      .join(' ');
    const dayLabels = days.map((d) => d.slice(5)).join('  ');
    console.log(`  ${heatRow}`);
    console.log(`  ${dayLabels}`);

    console.log('\n' + '─'.repeat(60));
    const total = Object.values(usage).reduce((a, b) => a + b, 0);
    console.log(`\n  总计使用 ${total} 次  |  覆盖 ${Object.keys(usage).length} 个 Skills\n`);
  });

statsCmd
  .command('reset')
  .description('清空所有统计数据')
  .action(() => {
    const data: StatsData = { usage: {}, streak: { current: 0, best: 0, lastDate: '' }, dailyLog: {} };
    writeStatsV2(data);
    console.log('\n✅ 统计数据已清空\n');
  });

// ─── pipeline 扩展（T20 Structured Pipeline with YAML support）──────────────
// YAML pipeline 支持：用户可以在 .ethan/pipelines/ 放自定义 pipeline YAML

interface CustomPipelineYaml {
  id: string;
  name: string;
  description: string;
  skillIds: string[];
  outputSchema?: Record<string, { type: string; description?: string; required?: boolean }>;
}

function loadCustomPipelines(cwd: string): CustomPipelineYaml[] {
  const dir = path.join(cwd, '.ethan', 'pipelines');
  if (!fs.existsSync(dir)) return [];

  const results: CustomPipelineYaml[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
    try {
      // 简单的 YAML 解析（仅支持内置 Pipeline YAML 格式，不依赖 js-yaml）
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      // 使用 js-yaml（已在 dependencies 中）
      const yaml = require('js-yaml');
      const parsed = yaml.load(raw) as CustomPipelineYaml;
      if (parsed && parsed.id && parsed.skillIds) results.push(parsed);
    } catch { /* ignore parse errors */ }
  }
  return results;
}

// ─── context 命令组 ────────────────────────────────────────────────────────

const contextCmd = program.command('context').description('采集并展示当前项目上下文快照（技术栈/git/目录树）');

contextCmd
  .command('show')
  .description('显示项目上下文快照（使用缓存，TTL 30min）')
  .option('--refresh', '强制重新采集，忽略缓存')
  .option('--json', '以 JSON 格式输出')
  .action(async (options: { refresh?: boolean; json?: boolean }) => {
    const { buildProjectSnapshot, loadCachedSnapshot, saveSnapshotCache, formatSnapshotForPrompt } = await import('../context/builder');
    let snapshot = options.refresh ? null : loadCachedSnapshot(process.cwd());
    if (!snapshot) {
      console.log('🔍 正在采集项目上下文...');
      snapshot = buildProjectSnapshot(process.cwd());
      saveSnapshotCache(snapshot, process.cwd());
    }
    if (options.json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log('\n' + formatSnapshotForPrompt(snapshot, false) + '\n');
      console.log(`（缓存时间：${snapshot.generatedAt}）\n`);
    }
  });

contextCmd
  .command('refresh')
  .description('强制重新采集，更新 .ethan/context.json 缓存')
  .action(async () => {
    const { buildProjectSnapshot, saveSnapshotCache, formatSnapshotForPrompt } = await import('../context/builder');
    console.log('🔍 正在采集项目上下文...');
    const snapshot = buildProjectSnapshot(process.cwd());
    saveSnapshotCache(snapshot, process.cwd());
    console.log('\n' + formatSnapshotForPrompt(snapshot, false) + '\n');
    console.log('✅ 项目上下文已更新并缓存到 .ethan/context.json\n');
  });

// ─── quality 命令组 ────────────────────────────────────────────────────────

const qualityCmd = program.command('quality').description('Skill 质量评估报告（基于 workflow done --rating 的评分数据）');

qualityCmd
  .command('report')
  .description('显示各 Skill 的质量评分报告（ASCII 条形图）')
  .option('--min-count <n>', '最少评分次数过滤（低于此数量的 Skill 不显示）', '1')
  .action((options: { minCount: string }) => {
    const minCount = parseInt(options.minCount, 10) || 1;
    const data = readStatsV2();
    const ratings = data.ratings || {};

    const entries = Object.entries(ratings)
      .map(([skillId, scores]) => ({
        skillId,
        scores,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
      }))
      .filter((e) => e.count >= minCount)
      .sort((a, b) => b.avg - a.avg);

    if (entries.length === 0) {
      console.log('\n📊 暂无评分数据。运行 ethan workflow done "摘要" --rating 4 记录评分。\n');
      return;
    }

    const globalAvg = entries.reduce((s, e) => s + e.avg, 0) / entries.length;

    console.log('\n📊 Skill 质量评估报告');
    console.log('─'.repeat(60));

    const BAR_MAX = 25;
    for (const e of entries) {
      const indicator = e.avg > 4 ? '🟢' : e.avg >= 3 ? '🟡' : '🔴';
      const bars = Math.round((e.avg / 5) * BAR_MAX);
      const bar = '█'.repeat(bars) + '░'.repeat(BAR_MAX - bars);
      const avgStr = e.avg.toFixed(1);
      console.log(`${indicator} ${e.skillId.padEnd(28)} ${bar}  ${avgStr}/5  (n=${e.count})`);
    }

    console.log('─'.repeat(60));
    console.log(`   全局平均分：${globalAvg.toFixed(1)}/5  （${entries.length} 个 Skill，共 ${entries.reduce((s, e) => s + e.count, 0)} 条评分）`);

    const lowSkills = entries.filter((e) => e.avg < 3);
    if (lowSkills.length > 0) {
      console.log('\n⚠️  低分 Skill（平均 < 3）需要关注：');
      lowSkills.forEach((e) => console.log(`   🔴 ${e.skillId}  avg=${e.avg.toFixed(1)}`));
    }
    console.log('');
  });

// ─── auto 命令 ──────────────────────────────────────────────────────────

program
  .command('auto [pipelineId]')
  .alias('autopilot')
  .description('生成「超级 prompt」：一次粘贴即可让 AI 自动链式执行完整 Pipeline，无需手动推进每一步')
  .option('-c, --context <context>', '任务上下文描述（如"实现用户登录功能"）', '')
  .option('--all', '生成全部 3 条 Pipeline 的超级 prompt')
  .option('--lang <lang>', '输出语言：zh（默认）或 en', '')
  .option('--with-context', '自动采集项目上下文（技术栈/git 提交/目录树）注入到提示词')
  .option('--no-copy', '不自动复制到剪贴板，直接打印到终端')
  .action(async (pipelineId: string | undefined, options: {
    context: string;
    all?: boolean;
    lang: string;
    withContext?: boolean;
    copy: boolean;
  }) => {
    const { resolvePipeline, PIPELINES } = await import('../skills/pipeline');
    const { buildAutopilotPrompt, buildAllPipelinesAutopilotPrompt } = await import('./autopilot');
    const { buildProjectSnapshot, loadCachedSnapshot, saveSnapshotCache } = await import('../context/builder');

    const config = readConfig(process.cwd());
    const isEn = (options.lang || config.lang || 'zh') === 'en';

    // 采集项目上下文快照（--with-context 或自动检测缓存）
    let snapshot = undefined as import('../context/builder').ProjectSnapshot | undefined;
    if (options.withContext) {
      const cached = loadCachedSnapshot(process.cwd());
      if (cached) {
        snapshot = cached;
      } else {
        console.log(isEn ? '🔍 Collecting project context...' : '🔍 正在采集项目上下文...');
        snapshot = buildProjectSnapshot(process.cwd());
        saveSnapshotCache(snapshot, process.cwd());
      }
    } else {
      // 静默注入：若缓存存在且未过期则自动使用
      const cached = loadCachedSnapshot(process.cwd());
      if (cached) snapshot = cached;
    }

    // 获取任务上下文（--context 或交互式输入）
    let context = (options.context || '').trim();
    if (!context) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
      context = await ask(isEn
        ? 'Describe your task context (e.g. "implement user login with JWT"):\n> '
        : '请描述任务背景（例如：实现用户登录功能，支持 JWT 认证）：\n> ');
      rl.close();
      if (!context) {
        console.error(isEn ? '\n❌ Context cannot be empty\n' : '\n❌ 任务背景不能为空\n');
        process.exit(1);
      }
    }

    let prompt: string;

    if (options.all) {
      // 生成全部 Pipeline 的超级 prompt
      const allResolved = PIPELINES.map((p) => resolvePipeline(p.id)!).filter(Boolean);
      prompt = buildAllPipelinesAutopilotPrompt(allResolved, { context, isEn, snapshot });
      console.log(isEn
        ? `\n🚀 Auto-Pilot prompt generated for all ${PIPELINES.length} pipelines`
        : `\n🚀 已生成全部 ${PIPELINES.length} 条 Pipeline 的超级 prompt`);
    } else {
      // 确定目标 Pipeline
      let id = pipelineId;
      if (!id) {
        const customPipelines = loadCustomPipelines(process.cwd());
        const allPipelines = [
          ...PIPELINES,
          ...customPipelines.map((p) => ({ id: p.id, name: p.name, description: p.description, skillIds: p.skillIds })),
        ];

        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q: string): Promise<string> =>
          new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

        console.log(isEn ? '\n🔄 Available Pipelines\n' : '\n🔄 可用工作流 Pipeline\n');
        console.log('─'.repeat(60));
        allPipelines.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.name}  [${p.id}]`);
          console.log(`     ${isEn ? p.description : p.description}`);
        });
        console.log('');

        const choice = await ask(isEn
          ? `Select pipeline (1-${allPipelines.length} or ID):\n> `
          : `选择 Pipeline（输入序号 1-${allPipelines.length}，或直接输入 ID）：\n> `);
        rl.close();

        const num = parseInt(choice, 10);
        if (!isNaN(num) && num >= 1 && num <= allPipelines.length) {
          id = allPipelines[num - 1].id;
        } else {
          id = choice;
        }
      }

      let resolved = resolvePipeline(id!);
      if (!resolved) {
        const customPipelines = loadCustomPipelines(process.cwd());
        const custom = customPipelines.find((p) => p.id === id);
        if (custom) {
          const customSkills = custom.skillIds
            .map((sid) => ALL_SKILLS.find((s) => s.id === sid))
            .filter((s): s is NonNullable<typeof s> => s != null);
          if (customSkills.length > 0) {
            resolved = { pipeline: { id: custom.id, name: custom.name, description: custom.description, skillIds: custom.skillIds }, skills: customSkills };
          }
        }
      }

      if (!resolved) {
        console.error(isEn ? `\n❌ Unknown pipeline: ${id}\n` : `\n❌ 未找到 Pipeline: ${id}\n`);
        console.error(`Available: ${PIPELINES.map((p) => p.id).join(' | ')}`);
        process.exit(1);
      }

      const { pipeline, skills } = resolved;
      prompt = buildAutopilotPrompt(pipeline, skills, { context, isEn, snapshot });

      console.log(isEn
        ? `\n🚀 Auto-Pilot prompt generated: ${pipeline.name} (${skills.length} steps)`
        : `\n🚀 超级 prompt 已生成：${pipeline.name}（${skills.length} 步）`);

      trackUsageWithStreak(`autopilot-${pipeline.id}`);
    }

    console.log('─'.repeat(60));

    if (options.copy !== false) {
      if (copyToClipboard(prompt)) {
        console.log(isEn
          ? '\n✅ Super prompt copied to clipboard! Paste it into your AI editor.'
          : '\n✅ 超级 prompt 已复制到剪贴板！粘贴到 AI 编辑器后，AI 将自动执行所有步骤。');
      } else {
        console.log('\n' + prompt + '\n');
      }
    } else {
      console.log('\n' + prompt + '\n');
    }

    console.log(isEn
      ? '\n💡 The AI will automatically chain all steps and deliver the final merged report.\n'
      : '\n💡 AI 将自动链式执行所有步骤，每步折叠展示，最终输出完整合并报告。\n');
  });

program
  .command('pipeline-init')
  .description('在 .ethan/pipelines/ 生成自定义 Pipeline YAML 模板')
  .option('--name <name>', 'Pipeline 名称（用于文件名）', 'my-pipeline')
  .action((options) => {
    const dir = path.join(process.cwd(), '.ethan', 'pipelines');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${options.name}.yaml`;
    const filePath = path.join(dir, filename);

    if (fs.existsSync(filePath)) {
      console.error(`❌ 文件已存在：${filePath}`);
      process.exit(1);
    }

    const template = `# Ethan 自定义 Pipeline 定义
# 放置在 .ethan/pipelines/ 目录下，ethan 自动加载

id: ${options.name}
name: 自定义工作流名称
description: 这个 Pipeline 的描述

# 引用的 Skill ID 列表（按执行顺序）
# 内置 Skill ID：
#   需求侧: requirement-understanding, prd
#   执行侧: task-breakdown, solution-design, api-design, implementation, deployment
#   跟踪侧: progress-tracking
#   输出侧: task-report, weekly-report
#   质量侧: code-review, debug, tech-research, security-review
# 也可以引用 .ethan/skills/ 中的自定义 Skill ID
skillIds:
  - requirement-understanding
  - solution-design
  - implementation
`;

    fs.writeFileSync(filePath, template, 'utf-8');
    console.log(`\n✅ 自定义 Pipeline 模板已生成：${filePath}`);
    console.log(`\n💡 编辑后运行：ethan workflow start ${options.name} -c "任务描述"\n`);
  });

// ─── spec 命令组 ─────────────────────────────────────────────────────────────
const specCmd = program.command('spec').description('OpenSpec 规范驱动开发工具集');

specCmd
  .command('init <capability>')
  .description('初始化 openspec/specs/[capability]/spec.md 规范文件')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .action(async (capability: string, options: { dir: string }) => {
    const { writeSpecFile, specTemplate } = await import('../spec/index');
    const filePath = writeSpecFile(capability, specTemplate(capability), options.dir);
    console.log(`\n✅ Spec 文件已创建：${filePath}`);
    console.log(`\n💡 编辑文件填写需求和场景，再运行 ethan spec validate ${capability} 检查格式\n`);
  });

specCmd
  .command('list')
  .description('列出所有 openspec/specs/ 下的 capability')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .action(async (options: { dir: string }) => {
    const { hasOpenSpec, listSpecs, listChanges } = await import('../spec/index');
    if (!hasOpenSpec(options.dir)) {
      console.log('\n⚠️  当前项目未检测到 openspec/ 目录。');
      console.log('运行 ethan spec init <capability> 初始化第一个 spec 文件。\n');
      return;
    }
    const specs = listSpecs(options.dir);
    const changes = listChanges(options.dir);
    console.log('\n📋 OpenSpec 规范目录\n');
    if (specs.length === 0) {
      console.log('  （openspec/specs/ 暂无 spec 文件）');
    } else {
      for (const spec of specs) {
        const lines = spec.content.split('\n').filter(Boolean);
        const reqCount = (spec.content.match(/### REQ-/g) || []).length;
        const scenCount = (spec.content.match(/### Scenario/g) || []).length;
        console.log(`  📄 ${spec.capability}  (${reqCount} 需求, ${scenCount} 场景)`);
        if (lines[0]) console.log(`     ${lines[0].replace(/^#+\s*/, '')}`);
      }
    }
    console.log(`\n📁 变更提案：${changes.length} 个`);
    for (const c of changes.slice(0, 5)) {
      const title = c.proposalContent?.split('\n').find((l) => l.startsWith('# '))?.replace('# ', '') || c.id;
      console.log(`  📝 ${c.id}  ${title}`);
    }
    console.log('');
  });

specCmd
  .command('show <capability>')
  .description('显示指定 capability 的 spec.md 内容')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .action(async (capability: string, options: { dir: string }) => {
    const { listSpecs } = await import('../spec/index');
    const specs = listSpecs(options.dir);
    const spec = specs.find((s) => s.capability === capability);
    if (!spec) {
      console.error(`\n❌ 未找到 capability: ${capability}`);
      console.error(`可用：${specs.map((s) => s.capability).join(', ') || '（无）'}\n`);
      process.exit(1);
    }
    console.log(`\n📄 ${capability}\n\n${spec.content}\n`);
  });

specCmd
  .command('validate [capability]')
  .description('校验 openspec/ 规范完整性（Requirements 编号、GIVEN/WHEN/THEN 格式）')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .option('--no-copy', '不复制到剪贴板', false)
  .action(async (capability: string | undefined, options: { dir: string; copy: boolean }) => {
    const { hasOpenSpec, listSpecs } = await import('../spec/index');
    if (!hasOpenSpec(options.dir)) {
      console.error('\n❌ 当前项目未检测到 openspec/ 目录。\n');
      process.exit(1);
    }
    const specs = listSpecs(options.dir);
    const filtered = capability ? specs.filter((s) => s.capability === capability) : specs;
    if (filtered.length === 0) {
      console.error(capability ? `\n❌ 未找到 capability: ${capability}\n` : '\n⚠️  openspec/specs/ 下没有任何 spec 文件\n');
      process.exit(1);
    }
    let totalIssues = 0;
    for (const spec of filtered) {
      const issues: string[] = [];
      const content = spec.content;
      if (!content.includes('## Purpose') && !content.includes('## 用途')) issues.push('缺少 ## Purpose 章节');
      if (!content.includes('## Requirements') && !content.includes('## 需求')) issues.push('缺少 ## Requirements 章节');
      if (!content.includes('## Scenarios') && !content.includes('## 场景')) issues.push('缺少 ## Scenarios 章节');
      const gwtRegex = /GIVEN[\s\S]*?WHEN[\s\S]*?THEN/i;
      if (content.includes('Scenario') && !gwtRegex.test(content)) issues.push('存在 Scenario 但未使用 GIVEN/WHEN/THEN 格式');
      totalIssues += issues.length;
      const icon = issues.length === 0 ? '✅' : issues.length <= 2 ? '⚠️ ' : '❌';
      console.log(`\n${icon} ${spec.capability}`);
      if (issues.length === 0) {
        console.log('   规范结构完整，无问题。');
      } else {
        issues.forEach((issue) => console.log(`   - ${issue}`));
      }
    }
    console.log(`\n汇总：${filtered.length} 个 capability，发现 ${totalIssues} 个问题。${totalIssues === 0 ? ' 🎉 全部通过！' : ''}\n`);
  });

specCmd
  .command('proposal <capability>')
  .description('生成 OpenSpec 变更提案包（proposal.md + design.md + tasks.md + spec delta）')
  .option('-c, --context <context>', '变更描述（如"新增用户邮箱二次验证"）', '')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .option('--no-copy', '不复制到剪贴板', false)
  .action(async (capability: string, options: { context: string; dir: string; copy: boolean }) => {
    const description = options.context || capability;
    const {
      listSpecs, generateChangeId, proposalTemplate, designTemplate, tasksTemplate,
      specDeltaTemplate, writeChangeFiles, hasOpenSpec,
    } = await import('../spec/index');

    if (!hasOpenSpec(options.dir)) {
      console.log('\n⚠️  未检测到 openspec/ 目录，自动初始化...');
      const { writeSpecFile, specTemplate } = await import('../spec/index');
      writeSpecFile(capability, specTemplate(capability), options.dir);
      console.log(`   已创建 openspec/specs/${capability}/spec.md\n`);
    }

    const changeId = generateChangeId();
    const proposal = proposalTemplate(changeId, description);
    const design = designTemplate(description);
    const tasks = tasksTemplate(description);
    const specDelta = specDeltaTemplate(capability, description);

    const changeDir = writeChangeFiles(
      changeId,
      { proposal, design, tasks, specDeltas: [{ capability, content: specDelta }] },
      options.dir
    );

    const specs = listSpecs(options.dir);
    console.log(`\n✅ 变更提案包已生成：${changeDir}`);
    console.log(`   📝 proposal.md — 填写变更描述和影响范围`);
    console.log(`   🏗️  design.md — 填写技术方案和架构决策`);
    console.log(`   📋 tasks.md — 填写分阶段任务列表`);
    console.log(`   📄 specs/${capability}.md — 填写需求变更 delta`);
    console.log(`\n💡 编辑完成后运行 ethan spec review 执行意图审查\n`);
    console.log(`   Change ID: ${changeId}`);
    if (specs.length > 0) {
      console.log(`   已有 Capability: ${specs.map((s) => s.capability).join(', ')}`);
    }
    console.log('');
  });

specCmd
  .command('review')
  .description('意图级 Spec Review：对比 spec delta 与代码变更，输出对齐矩阵和偏差报告')
  .option('--change-id <id>', '指定 Change ID（不填则取最新）', '')
  .option('-d, --dir <dir>', '项目目录', process.cwd())
  .option('--no-copy', '不复制到剪贴板', false)
  .action(async (options: { changeId: string; dir: string; copy: boolean }) => {
    const { hasOpenSpec, loadLatestChange, listChanges, truncateSpec } = await import('../spec/index');

    if (!hasOpenSpec(options.dir)) {
      console.error('\n❌ 当前项目未检测到 openspec/ 目录。先运行 ethan spec init <capability> 初始化。\n');
      process.exit(1);
    }

    const changes = listChanges(options.dir);
    if (changes.length === 0) {
      console.error('\n⚠️  未找到任何变更提案（openspec/changes/ 为空）。先运行 ethan spec proposal <capability> 创建提案。\n');
      process.exit(1);
    }

    const change = options.changeId
      ? (changes.find((c) => c.id === options.changeId) ?? loadLatestChange(options.dir))
      : loadLatestChange(options.dir);

    if (!change) {
      console.error(`\n❌ 未找到 Change ID: ${options.changeId}\n`);
      process.exit(1);
    }

    const gitDiff = isGitRepo(options.dir) ? getBranchDiff(options.dir) : '';
    const truncatedDiff = gitDiff ? truncateDiff(gitDiff, 6000) : '（非 git 仓库或无代码变更）';

    let prompt = `# Spec Review — ${change.id}\n\n`;
    if (change.proposalContent) {
      prompt += `## 变更提案\n\n${truncateSpec(change.proposalContent, 800)}\n\n`;
    }
    if (change.specDeltas.length > 0) {
      prompt += `## Spec Delta（需求变更）\n\n`;
      for (const delta of change.specDeltas) {
        prompt += `### ${delta.capability}\n\n${truncateSpec(delta.content, 600)}\n\n`;
      }
    }
    prompt += `## 代码变更（Diff）\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n\n`;
    prompt += `---\n\n## 意图审查任务\n\n`;
    prompt += `请对照上方 spec delta 与代码 diff，执行意图级 Review：\n\n`;
    prompt += `1. **意图对齐矩阵**\n\n   | Spec 需求/场景 | 代码位置 | 状态 | 说明 |\n   |---|---|---|---|\n\n`;
    prompt += `2. **🔴 意图偏差（Critical）**：实现与 spec 意图严重不符，必须修复\n`;
    prompt += `3. **🟡 遗漏需求（Warning）**：spec 有但代码未实现\n`;
    prompt += `4. **💡 超范围实现（Info）**：代码实现了 spec 未定义的功能\n`;
    prompt += `5. **审查结论**：可合并 / 需要修复 / 需要更新 spec\n\n`;
    prompt += `> Review intent, not just code。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ Spec Review 提示词已复制到剪贴板（Change: ${change.id}）`);
      console.log('   粘贴到 AI 编辑器执行意图审查。\n');
    } else {
      console.log(prompt);
    }
  });

// ─── diff ─────────────────────────────────────────────────────────────────────
program
  .command('diff [base] [head]')
  .description('读取 git diff，生成变更风险分析提示词')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((base: string | undefined, head: string | undefined, options: { copy: boolean }) => {
    if (!isGitRepo(process.cwd())) {
      console.error('\n❌ 当前目录不是 git 仓库\n');
      process.exit(1);
    }
    const ref = base && head ? `${base}..${head}` : (base ?? 'HEAD');
    const diffArgs = base && head ? [base, head] : base ? [base] : [];
    const result = spawnSync('git', ['diff', ...diffArgs, '--stat', '--no-color'], {
      cwd: process.cwd(), encoding: 'utf-8',
    });
    const stat = result.stdout ?? '';
    const fullDiff = spawnSync('git', ['diff', ...diffArgs, '--no-color'], {
      cwd: process.cwd(), encoding: 'utf-8',
    }).stdout ?? '';
    const truncated = truncateDiff(fullDiff, 5000);

    const prompt =
      `# 变更风险分析\n\n` +
      `**范围**: \`git diff ${ref}\`\n\n` +
      `## 变更统计\n\n\`\`\`\n${stat || '(无统计输出)'}\n\`\`\`\n\n` +
      `## Diff 内容\n\n\`\`\`diff\n${truncated || '(无变更)'}\n\`\`\`\n\n` +
      `---\n\n` +
      `请分析上述代码变更，输出：\n` +
      `1. **变更摘要**：一句话概括本次改动目的\n` +
      `2. **风险评估**（高/中/低）：潜在 Bug、破坏性变更、性能影响\n` +
      `3. **关注点**：最需要审查的文件/逻辑\n` +
      `4. **建议**：测试覆盖缺口、文档更新建议`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log('\n✅ 变更风险分析提示词已复制到剪贴板\n');
    } else {
      console.log(prompt);
    }
  });

// ─── deps ─────────────────────────────────────────────────────────────────────
program
  .command('deps')
  .description('读取 package.json + npm outdated 生成依赖健康报告提示词')
  .option('--fix', '同时输出升级命令', false)
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { fix: boolean; copy: boolean }) => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
      console.error('\n❌ 未找到 package.json\n');
      process.exit(1);
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const outdatedResult = spawnSync('npm', ['outdated', '--json'], {
      cwd: process.cwd(), encoding: 'utf-8',
    });
    const outdated = outdatedResult.stdout ? JSON.parse(outdatedResult.stdout) : {};
    const auditResult = spawnSync('npm', ['audit', '--json'], {
      cwd: process.cwd(), encoding: 'utf-8',
    });
    let auditSummary = '（npm audit 失败）';
    try {
      const auditData = JSON.parse(auditResult.stdout ?? '{}');
      const vuln = auditData.metadata?.vulnerabilities ?? {};
      auditSummary = `critical: ${vuln.critical ?? 0}, high: ${vuln.high ?? 0}, moderate: ${vuln.moderate ?? 0}, low: ${vuln.low ?? 0}`;
    } catch { /* ignore */ }

    const outdatedEntries = Object.entries(outdated).slice(0, 20)
      .map(([name, info]: [string, unknown]) => {
        const d = info as Record<string, string>;
        return `- ${name}: ${d.current} → ${d.latest} (wanted: ${d.wanted})`;
      }).join('\n');

    const prompt =
      `# 依赖健康报告\n\n` +
      `**项目**: ${pkg.name ?? 'unknown'} v${pkg.version ?? '?'}\n\n` +
      `## 安全漏洞摘要\n\n${auditSummary}\n\n` +
      `## 过时依赖（前20项）\n\n${outdatedEntries || '（无过时依赖）'}\n\n` +
      `## 依赖数量\n\n` +
      `- dependencies: ${Object.keys(pkg.dependencies ?? {}).length}\n` +
      `- devDependencies: ${Object.keys(pkg.devDependencies ?? {}).length}\n\n` +
      (options.fix ? `## 建议升级命令\n\nnpm update\nnpm audit fix\n\n` : '') +
      `---\n\n请分析依赖健康状况，输出优先级排序的升级建议和安全漏洞修复方案。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log('\n✅ 依赖健康报告提示词已复制到剪贴板\n');
    } else {
      console.log(prompt);
    }
  });

// ─── dora ─────────────────────────────────────────────────────────────────────
program
  .command('dora')
  .description('统计 git 历史，计算 DORA 四键指标')
  .option('--since <days>', '统计最近 N 天', '30')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { since: string; copy: boolean }) => {
    if (!isGitRepo(process.cwd())) {
      console.error('\n❌ 当前目录不是 git 仓库\n');
      process.exit(1);
    }
    const days = parseInt(options.since, 10) || 30;
    const since = `${days}.days.ago`;

    // Deploy Frequency: count merges to main
    const merges = spawnSync('git', ['log', '--merges', '--oneline', `--since=${since}`], {
      cwd: process.cwd(), encoding: 'utf-8',
    }).stdout ?? '';
    const mergeCount = merges.trim() ? merges.trim().split('\n').length : 0;
    const deployFreq = (mergeCount / days).toFixed(2);

    // Tags as releases
    const tags = spawnSync('git', ['log', '--tags', '--oneline', `--since=${since}`, '--simplify-by-decoration'], {
      cwd: process.cwd(), encoding: 'utf-8',
    }).stdout ?? '';
    const tagCount = tags.trim() ? tags.trim().split('\n').length : 0;

    // Commit count for lead time proxy
    const commits = spawnSync('git', ['log', '--oneline', `--since=${since}`], {
      cwd: process.cwd(), encoding: 'utf-8',
    }).stdout ?? '';
    const commitCount = commits.trim() ? commits.trim().split('\n').length : 0;

    const freqLevel = mergeCount / days >= 1 ? 'Elite' : mergeCount / days >= 1/7 ? 'High' : mergeCount / days >= 1/30 ? 'Medium' : 'Low';

    const report =
      `# DORA 四键指标报告\n\n` +
      `**统计范围**: 最近 ${days} 天\n\n` +
      `| 指标 | 数值 | 等级 |\n` +
      `|------|------|------|\n` +
      `| 部署频率 (Deploy Frequency) | ${deployFreq} 次/天（共 ${mergeCount} 次合并） | **${freqLevel}** |\n` +
      `| 版本发布 (Tags/Releases) | ${tagCount} 次 | — |\n` +
      `| 提交总数 (Commit Count) | ${commitCount} 次 | — |\n\n` +
      `> 等级：Elite（每天多次）> High（每天1次）> Medium（每周1次）> Low（每月1次）\n\n` +
      `---\n\n` +
      `请根据以上 DORA 数据，分析工程效能现状，并给出：\n` +
      `1. **当前等级评估** 及改进空间\n` +
      `2. **瓶颈分析**：部署频率低的可能原因\n` +
      `3. **改进建议**：3-5条可操作的效能提升措施`;

    if (options.copy !== false) {
      copyToClipboard(report);
      console.log(`\n✅ DORA 指标报告已复制到剪贴板（最近 ${days} 天）\n`);
    } else {
      console.log(report);
    }
  });

// ─── pr-analytics ─────────────────────────────────────────────────────────────
program
  .command('pr-analytics')
  .description('分析 PR 合并历史：大小分布、热点文件 Top 10')
  .option('--days <n>', '统计最近 N 天', '30')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { days: string; copy: boolean }) => {
    if (!isGitRepo(process.cwd())) {
      console.error('\n❌ 当前目录不是 git 仓库\n');
      process.exit(1);
    }
    const days = parseInt(options.days, 10) || 30;
    const merges = spawnSync('git', ['log', '--merges', `--since=${days}.days.ago`, '--format=%H %s'], {
      cwd: process.cwd(), encoding: 'utf-8',
    }).stdout ?? '';
    const mergeLines = merges.trim() ? merges.trim().split('\n') : [];

    // Count changed files across merges (sample up to 10)
    const fileChanges: Record<string, number> = {};
    for (const line of mergeLines.slice(0, 10)) {
      const hash = line.split(' ')[0];
      const files = spawnSync('git', ['diff-tree', '--no-commit-id', '-r', '--name-only', hash], {
        cwd: process.cwd(), encoding: 'utf-8',
      }).stdout ?? '';
      for (const f of files.trim().split('\n').filter(Boolean)) {
        fileChanges[f] = (fileChanges[f] ?? 0) + 1;
      }
    }
    const hotFiles = Object.entries(fileChanges)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([f, n]) => `- ${f} (${n} 次)`)
      .join('\n');

    const report =
      `# PR 分析报告\n\n` +
      `**统计范围**: 最近 ${days} 天 | **合并 PR 数**: ${mergeLines.length}\n\n` +
      `## 热点文件 Top 10（变更最频繁）\n\n${hotFiles || '（无数据）'}\n\n` +
      `---\n\n请分析 PR 模式，给出：\n` +
      `1. PR 规模是否合理（是否有超大 PR）\n` +
      `2. 热点文件是否存在过度耦合或技术债\n` +
      `3. 改进建议`;

    if (options.copy !== false) {
      copyToClipboard(report);
      console.log('\n✅ PR 分析报告已复制到剪贴板\n');
    } else {
      console.log(report);
    }
  });

// ─── adr ──────────────────────────────────────────────────────────────────────
program
  .command('adr <action> [title]')
  .description('管理 ADR（架构决策记录）：new | list | show <n>')
  .action((action: string, title: string | undefined) => {
    const adrDir = path.join(process.cwd(), 'docs', 'adr');
    if (action === 'list') {
      if (!fs.existsSync(adrDir)) { console.log('(无 ADR 记录，运行 ethan adr new "标题" 创建)'); return; }
      const files = fs.readdirSync(adrDir).filter((f) => f.endsWith('.md')).sort();
      if (files.length === 0) { console.log('(无 ADR 记录)'); return; }
      console.log('\n📋 ADR 列表:\n');
      files.forEach((f) => console.log(`  ${f}`));
      console.log('');
    } else if (action === 'new') {
      if (!title) { console.error('\n❌ 用法：ethan adr new "决策标题"\n'); process.exit(1); }
      fs.mkdirSync(adrDir, { recursive: true });
      const existing = fs.existsSync(adrDir) ? fs.readdirSync(adrDir).filter((f) => /^\d{4}/.test(f)) : [];
      const num = String(existing.length + 1).padStart(4, '0');
      const slug = title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^\w-]/g, '').slice(0, 50);
      const filename = `${num}-${slug}.md`;
      const content =
        `# ${num}. ${title}\n\n` +
        `**日期**: ${new Date().toISOString().split('T')[0]}\n` +
        `**状态**: 提议中 (Proposed)\n\n` +
        `## 背景\n\n[描述需要做出此决策的背景和问题]\n\n` +
        `## 决策\n\n[描述做出的决策]\n\n` +
        `## 后果\n\n[描述此决策带来的影响（正面和负面）]\n`;
      fs.writeFileSync(path.join(adrDir, filename), content, 'utf-8');
      console.log(`\n✅ ADR 已创建：docs/adr/${filename}\n`);
    } else if (action === 'show') {
      if (!title) { console.error('\n❌ 用法：ethan adr show <序号或文件名>\n'); process.exit(1); }
      if (!fs.existsSync(adrDir)) { console.error('\n❌ docs/adr/ 目录不存在\n'); process.exit(1); }
      const files = fs.readdirSync(adrDir).filter((f) => f.startsWith(title.padStart(4, '0')));
      if (files.length === 0) { console.error(`\n❌ 未找到 ADR #${title}\n`); process.exit(1); }
      console.log(fs.readFileSync(path.join(adrDir, files[0]), 'utf-8'));
    } else {
      console.error(`\n❌ 未知操作: ${action}（支持: new | list | show）\n`);
      process.exit(1);
    }
  });

// ─── mermaid ──────────────────────────────────────────────────────────────────
program
  .command('mermaid')
  .description('生成 Mermaid 图表提示词（flowchart/sequence/er/architecture/gantt）')
  .option('--type <type>', '图表类型：flowchart | sequence | er | architecture | gantt', 'flowchart')
  .option('--desc <desc>', '图表描述', '')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { type: string; desc: string; copy: boolean }) => {
    const typeGuide: Record<string, string> = {
      flowchart:    '流程图（节点 + 判断分支 + 连线）',
      sequence:     '时序图（参与者 + 消息序列）',
      er:           'ER 图（实体 + 属性 + 关系）',
      architecture: '架构图（服务/组件 + 依赖关系）',
      gantt:        '甘特图（任务 + 时间轴）',
    };
    const guide = typeGuide[options.type] ?? typeGuide.flowchart;
    const desc = options.desc || '请根据上下文自动推断内容';
    const prompt =
      `# Mermaid 图表生成\n\n` +
      `**类型**: ${options.type}（${guide}）\n` +
      `**描述**: ${desc}\n\n` +
      `请生成一个标准的 Mermaid ${options.type} 图表，要求：\n` +
      `1. 语法严格符合 Mermaid 规范，可直接粘贴到 Markdown 中渲染\n` +
      `2. 节点/参与者命名清晰，使用中文标签\n` +
      `3. 覆盖主要流程/关系，避免过度简化\n` +
      `4. 输出格式：\`\`\`mermaid\\n...\\n\`\`\`\n\n` +
      `同时附上简短说明，解释图表的核心逻辑。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ Mermaid ${options.type} 图表提示词已复制到剪贴板\n`);
    } else {
      console.log(prompt);
    }
  });

// ─── i18n ─────────────────────────────────────────────────────────────────────
program
  .command('i18n [file]')
  .description('扫描硬编码字符串，生成 i18n key 提取提案')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((file: string | undefined, options: { copy: boolean }) => {
    let fileContent = '';
    let targetDesc = '项目代码';
    if (file) {
      const fp = resolveFilePath(file);
      if (!fs.existsSync(fp)) { console.error(`\n❌ 文件不存在: ${file}\n`); process.exit(1); }
      fileContent = fs.readFileSync(fp, 'utf-8');
      targetDesc = file;
    }
    const prompt =
      `# i18n 国际化提取\n\n` +
      `**目标**: ${targetDesc}\n\n` +
      (fileContent ? `## 代码内容\n\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\`\n\n` : '') +
      `## 任务\n\n` +
      `1. **扫描硬编码字符串**：识别所有中文/英文界面文本（按钮、标题、提示、错误消息等）\n` +
      `2. **生成 key 方案**：为每个字符串建议语义化的 i18n key（如 \`common.btn.submit\`）\n` +
      `3. **输出 locale 文件**：生成 zh-CN.json 和 en-US.json 的初始内容\n` +
      `4. **代码替换示例**：展示如何将硬编码替换为 i18n 调用（兼容 react-i18next / vue-i18n）\n` +
      `5. **遗漏风险**：标注可能遗漏的动态字符串或复数形式`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log('\n✅ i18n 提取提案提示词已复制到剪贴板\n');
    } else {
      console.log(prompt);
    }
  });

// ─── onboard ──────────────────────────────────────────────────────────────────
program
  .command('onboard')
  .description('生成新成员上手文档提示词')
  .option('--lang <lang>', '编程语言/技术栈（可选）', '')
  .option('--no-copy', '不复制到剪贴板', false)
  .action(async (options: { lang: string; copy: boolean }) => {
    const snapshot = await (async () => {
      try {
        const { buildProjectSnapshot } = await import('../context/builder');
        return buildProjectSnapshot(process.cwd());
      } catch { return null; }
    })();

    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : {};

    const prompt =
      `# 新成员上手文档生成\n\n` +
      `**项目**: ${pkg.name ?? path.basename(process.cwd())} v${pkg.version ?? '?'}\n` +
      (options.lang ? `**技术栈**: ${options.lang}\n` : '') +
      (snapshot ? `**项目快照**: ${JSON.stringify(snapshot).slice(0, 500)}\n` : '') +
      `\n## 请生成以下上手文档：\n\n` +
      `1. **项目概述**：用 3 句话解释这个项目是什么、解决什么问题\n` +
      `2. **快速启动**：本地开发环境配置步骤（含前置条件）\n` +
      `3. **目录结构**：核心目录说明（只解释重要的）\n` +
      `4. **开发工作流**：分支策略、提交规范、PR 流程\n` +
      `5. **关键概念**：新人必须理解的 3-5 个领域概念\n` +
      `6. **常见问题**：FAQ（本地启动失败、测试怎么跑等）\n` +
      `7. **联系方式**：谁负责什么模块（留空供补充）`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log('\n✅ 新成员上手文档提示词已复制到剪贴板\n');
    } else {
      console.log(prompt);
    }
  });

// ─── test-coverage ────────────────────────────────────────────────────────────
program
  .command('test-coverage')
  .description('读取覆盖率报告，生成覆盖率优化提示词')
  .option('--threshold <n>', '覆盖率目标（默认 80）', '80')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { threshold: string; copy: boolean }) => {
    const summaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    let summaryText = '（未找到 coverage/coverage-summary.json，请先运行 npm run test:coverage）';
    if (fs.existsSync(summaryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        const total = data.total ?? {};
        summaryText =
          `语句: ${total.statements?.pct ?? '?'}% | ` +
          `分支: ${total.branches?.pct ?? '?'}% | ` +
          `函数: ${total.functions?.pct ?? '?'}% | ` +
          `行: ${total.lines?.pct ?? '?'}%`;
      } catch { /* ignore */ }
    }
    const threshold = parseInt(options.threshold, 10) || 80;
    const prompt =
      `# 测试覆盖率优化\n\n` +
      `**当前覆盖率**: ${summaryText}\n` +
      `**目标覆盖率**: ${threshold}%\n\n` +
      `## 任务\n\n` +
      `1. **覆盖率差距分析**：当前覆盖率 vs 目标，差多少\n` +
      `2. **优先补测区域**：哪些文件/函数覆盖率最低，业务风险最高\n` +
      `3. **测试补充方案**：为低覆盖区域设计具体的测试用例（AAA 格式）\n` +
      `4. **Mock 策略**：依赖外部服务的单元如何 Mock\n` +
      `5. **CI 集成**：如何在 CI 中设置覆盖率门禁`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log('\n✅ 测试覆盖率优化提示词已复制到剪贴板\n');
    } else {
      console.log(prompt);
    }
  });

// ─── migrate ──────────────────────────────────────────────────────────────────
program
  .command('migrate')
  .description('生成框架/工具迁移助手提示词')
  .option('--from <source>', '迁移来源（如 cra, webpack4, jest）', '')
  .option('--to <target>', '迁移目标（如 vite, webpack5, vitest）', '')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { from: string; to: string; copy: boolean }) => {
    const from = options.from || '（请指定 --from）';
    const to = options.to || '（请指定 --to）';
    const prompt =
      `# 框架迁移方案：${from} → ${to}\n\n` +
      `## 任务\n\n` +
      `请生成从 **${from}** 迁移到 **${to}** 的完整方案：\n\n` +
      `1. **迁移前提**：前置条件、兼容性检查、破坏性变更清单\n` +
      `2. **迁移步骤**（分阶段，每步可回滚）：\n` +
      `   - 安装新依赖\n   - 配置文件变更\n   - 代码变更模式（Before/After 对照）\n` +
      `3. **常见陷阱**：迁移过程中的已知问题和解决方案\n` +
      `4. **验证方案**：每步完成后的检验命令/检查项\n` +
      `5. **回滚方案**：遇到阻塞时如何安全回退\n\n` +
      `> 请基于最新版本的官方迁移指南，重点关注 Breaking Changes。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ 迁移方案提示词已复制（${from} → ${to}）\n`);
    } else {
      console.log(prompt);
    }
  });

// ─── postmortem ───────────────────────────────────────────────────────────────
program
  .command('postmortem')
  .description('生成结构化故障复盘（Postmortem）提示词')
  .option('--incident <id>', '事故 ID（如 INC-001）', '')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { incident: string; copy: boolean }) => {
    const incidentId = options.incident || `INC-${Date.now().toString().slice(-6)}`;
    const recentCommits = isGitRepo(process.cwd())
      ? (spawnSync('git', ['log', '--oneline', '-10'], { cwd: process.cwd(), encoding: 'utf-8' }).stdout ?? '')
      : '';

    const prompt =
      `# 故障复盘（Postmortem）— ${incidentId}\n\n` +
      (recentCommits ? `## 近期提交记录（参考）\n\n\`\`\`\n${recentCommits}\`\`\`\n\n` : '') +
      `## 请生成标准化的 Postmortem 报告（Google SRE 格式）：\n\n` +
      `### 1. 事故摘要\n- 开始/结束时间\n- 影响范围（用户/功能/地区）\n- 严重程度（P0-P3）\n- 一句话根因\n\n` +
      `### 2. 时间线\n（请描述事故经过，我来整理成时间轴格式）\n\n` +
      `### 3. 根因分析（5 Why）\n追问 5 次 "为什么" 直到找到系统性原因\n\n` +
      `### 4. 贡献因素\n- 技术因素\n- 流程因素\n- 人员因素\n\n` +
      `### 5. 后续行动（附责任人 + 截止日期）\n- P0（24h内）\n- P1（1周内）\n- P2（1月内）\n\n` +
      `### 6. 经验教训\n\n> 请描述事故经过，我来生成完整复盘报告。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ Postmortem 提示词已复制（${incidentId}）\n`);
    } else {
      console.log(prompt);
    }
  });

// ─── decision-log ─────────────────────────────────────────────────────────────
program
  .command('decision-log <action> [query]')
  .description('管理技术决策记录（.ethan/decisions/）：new | list | search <关键词>')
  .action((action: string, query: string | undefined) => {
    const decDir = path.join(process.cwd(), '.ethan', 'decisions');
    if (action === 'list') {
      if (!fs.existsSync(decDir)) { console.log('(无决策记录，运行 ethan decision-log new 创建)'); return; }
      const files = fs.readdirSync(decDir).filter((f) => f.endsWith('.md')).sort().reverse();
      if (files.length === 0) { console.log('(无决策记录)'); return; }
      console.log(`\n📋 决策记录（共 ${files.length} 条）:\n`);
      files.forEach((f) => console.log(`  ${f}`));
      console.log('');
    } else if (action === 'new') {
      fs.mkdirSync(decDir, { recursive: true });
      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-decision.md`;
      const fp = path.join(decDir, filename);
      const content =
        `# 技术决策记录\n\n` +
        `**日期**: ${date}\n` +
        `**状态**: 已决策\n\n` +
        `## 背景\n\n[描述需要做出此决策的背景]\n\n` +
        `## 决策\n\n[描述选择了什么方案]\n\n` +
        `## 理由\n\n[为什么选这个方案而非其他]\n\n` +
        `## 后果\n\n[此决策带来的影响]\n`;
      fs.writeFileSync(fp, content, 'utf-8');
      console.log(`\n✅ 决策记录已创建：.ethan/decisions/${filename}\n`);
    } else if (action === 'search') {
      if (!query) { console.error('\n❌ 用法：ethan decision-log search <关键词>\n'); process.exit(1); }
      if (!fs.existsSync(decDir)) { console.log('(无决策记录)'); return; }
      const files = fs.readdirSync(decDir).filter((f) => f.endsWith('.md'));
      const matched = files.filter((f) => {
        const content = fs.readFileSync(path.join(decDir, f), 'utf-8');
        return content.includes(query) || f.includes(query);
      });
      if (matched.length === 0) { console.log(`(未找到包含 "${query}" 的决策记录)`); return; }
      console.log(`\n🔍 匹配 "${query}" 的决策记录:\n`);
      matched.forEach((f) => console.log(`  ${f}`));
      console.log('');
    } else {
      console.error(`\n❌ 未知操作: ${action}（支持: new | list | search）\n`);
      process.exit(1);
    }
  });

// ─── knowledge ────────────────────────────────────────────────────────────────
program
  .command('knowledge <action> [entry]')
  .description('管理团队知识库（.ethan/team-knowledge/）：add | list | search <关键词>')
  .action((action: string, entry: string | undefined) => {
    const kbDir = path.join(process.cwd(), '.ethan', 'team-knowledge');
    if (action === 'list') {
      if (!fs.existsSync(kbDir)) { console.log('(无知识条目，运行 ethan knowledge add "内容" 添加)'); return; }
      const files = fs.readdirSync(kbDir).filter((f) => f.endsWith('.md')).sort().reverse();
      if (files.length === 0) { console.log('(无知识条目)'); return; }
      console.log(`\n📚 知识库（共 ${files.length} 条）:\n`);
      files.slice(0, 20).forEach((f) => console.log(`  ${f}`));
      if (files.length > 20) console.log(`  ... 还有 ${files.length - 20} 条`);
      console.log('');
    } else if (action === 'add') {
      if (!entry) { console.error('\n❌ 用法：ethan knowledge add "知识内容"\n'); process.exit(1); }
      fs.mkdirSync(kbDir, { recursive: true });
      const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${date}-knowledge.md`;
      const content = `# 知识条目\n\n**日期**: ${date}\n\n${entry}\n`;
      fs.writeFileSync(path.join(kbDir, filename), content, 'utf-8');
      console.log(`\n✅ 知识条目已保存：.ethan/team-knowledge/${filename}\n`);
    } else if (action === 'search') {
      if (!entry) { console.error('\n❌ 用法：ethan knowledge search <关键词>\n'); process.exit(1); }
      if (!fs.existsSync(kbDir)) { console.log('(无知识条目)'); return; }
      const files = fs.readdirSync(kbDir).filter((f) => f.endsWith('.md'));
      const matched: Array<{ file: string; excerpt: string }> = [];
      for (const f of files) {
        const content = fs.readFileSync(path.join(kbDir, f), 'utf-8');
        if (content.includes(entry) || f.includes(entry)) {
          const idx = content.indexOf(entry);
          const excerpt = content.slice(Math.max(0, idx - 30), idx + 80).replace(/\n/g, ' ');
          matched.push({ file: f, excerpt });
        }
      }
      if (matched.length === 0) { console.log(`(未找到 "${entry}")`); return; }
      console.log(`\n🔍 匹配 "${entry}" 的知识条目:\n`);
      matched.slice(0, 10).forEach(({ file, excerpt }) => {
        console.log(`  📄 ${file}`);
        console.log(`     ...${excerpt}...`);
      });
      console.log('');
    } else {
      console.error(`\n❌ 未知操作: ${action}（支持: add | list | search）\n`);
      process.exit(1);
    }
  });

// ─── oss ──────────────────────────────────────────────────────────────────────
program
  .command('oss <action>')
  .description('开源项目工具套件：triage | release-notes | contributor-guide | health-score')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((action: string, options: { copy: boolean }) => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : {};
    const projName = pkg.name ?? path.basename(process.cwd());

    const prompts: Record<string, string> = {
      triage:
        `# 开源 Issue Triage — ${projName}\n\n` +
        `请帮我处理开源项目 Issue 分流：\n` +
        `1. 对 Issue 进行分类：Bug / Feature Request / Question / Documentation\n` +
        `2. 评估优先级（P0-P3）并说明理由\n` +
        `3. 起草回复模板（友好、专业、附后续步骤）\n` +
        `4. 建议 Label 标签\n\n请粘贴需要处理的 Issue 内容：`,
      'release-notes':
        `# Release Notes 生成 — ${projName}\n\n` +
        (isGitRepo(process.cwd())
          ? `## 最近提交\n\n\`\`\`\n${(spawnSync('git', ['log', '--oneline', '-20'], { cwd: process.cwd(), encoding: 'utf-8' }).stdout ?? '').trim()}\n\`\`\`\n\n`
          : '') +
        `请基于以上提交记录，生成规范的 Release Notes：\n` +
        `1. 按类型分组：🚀 New Features / 🐛 Bug Fixes / ⚠️ Breaking Changes / 📚 Documentation\n` +
        `2. 语言简洁，面向用户而非开发者\n` +
        `3. 标注 Breaking Changes 的迁移指南\n` +
        `4. 输出 Markdown 格式`,
      'contributor-guide':
        `# Contributor Guide 生成 — ${projName}\n\n` +
        `请生成 CONTRIBUTING.md 内容：\n` +
        `1. 开发环境配置（fork → clone → install → dev）\n` +
        `2. 代码规范（命名 / 注释 / 测试要求）\n` +
        `3. PR 提交流程（分支命名 / commit 规范 / PR 描述模板）\n` +
        `4. Issue 报告规范\n` +
        `5. 社区行为准则参考`,
      'health-score':
        `# 开源项目健康评分 — ${projName}\n\n` +
        `请从以下维度评估开源项目健康度（各维度 0-10 分）：\n\n` +
        `| 维度 | 评分 | 说明 |\n|------|------|------|\n` +
        `| 文档完整性 | | README/CONTRIBUTING/CHANGELOG |\n` +
        `| 测试覆盖率 | | 是否有 CI + 覆盖率报告 |\n` +
        `| Issue 响应时间 | | 最近 issue 多久被回复 |\n` +
        `| 版本发布规律 | | 是否定期发版 |\n` +
        `| 社区活跃度 | | Star 趋势 / PR 数量 |\n` +
        `| 依赖安全 | | 是否有高危 CVE |\n\n` +
        `请基于仓库实际情况给出评分和改进建议。`,
    };

    const prompt = prompts[action];
    if (!prompt) {
      console.error(`\n❌ 未知操作: ${action}（支持: triage | release-notes | contributor-guide | health-score）\n`);
      process.exit(1);
    }
    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ OSS ${action} 提示词已复制到剪贴板\n`);
    } else {
      console.log(prompt);
    }
  });

// ─── prompt-lib ───────────────────────────────────────────────────────────────
program
  .command('prompt-lib <action> [name]')
  .description('管理 Prompt 资产库（.ethan/prompts/）：add | list | search | show <名称>')
  .option('--content <content>', 'Prompt 内容（add 时使用）', '')
  .action((action: string, name: string | undefined, options: { content: string }) => {
    const promptDir = path.join(process.cwd(), '.ethan', 'prompts');
    if (action === 'list') {
      if (!fs.existsSync(promptDir)) { console.log('(无 Prompt，运行 ethan prompt-lib add <名称> --content "内容" 添加)'); return; }
      const files = fs.readdirSync(promptDir).filter((f) => f.endsWith('.md')).sort();
      if (files.length === 0) { console.log('(无 Prompt)'); return; }
      console.log(`\n📝 Prompt 库（共 ${files.length} 条）:\n`);
      files.forEach((f) => console.log(`  ${f.replace('.md', '')}`));
      console.log('');
    } else if (action === 'add') {
      if (!name) { console.error('\n❌ 用法：ethan prompt-lib add <名称> --content "Prompt内容"\n'); process.exit(1); }
      if (!options.content) { console.error('\n❌ 缺少 --content 参数\n'); process.exit(1); }
      fs.mkdirSync(promptDir, { recursive: true });
      const filename = `${name.replace(/[/\\:*?"<>|]/g, '-')}.md`;
      const content = `# ${name}\n\n**创建时间**: ${new Date().toISOString().split('T')[0]}\n\n## Prompt\n\n${options.content}\n`;
      fs.writeFileSync(path.join(promptDir, filename), content, 'utf-8');
      console.log(`\n✅ Prompt 已保存：.ethan/prompts/${filename}\n`);
    } else if (action === 'show') {
      if (!name) { console.error('\n❌ 用法：ethan prompt-lib show <名称>\n'); process.exit(1); }
      if (!fs.existsSync(promptDir)) { console.error('\n❌ Prompt 库为空\n'); process.exit(1); }
      const filename = `${name}.md`;
      const fp = path.join(promptDir, filename);
      if (!fs.existsSync(fp)) { console.error(`\n❌ 未找到 Prompt: ${name}\n`); process.exit(1); }
      console.log(fs.readFileSync(fp, 'utf-8'));
    } else if (action === 'search') {
      if (!name) { console.error('\n❌ 用法：ethan prompt-lib search <关键词>\n'); process.exit(1); }
      if (!fs.existsSync(promptDir)) { console.log('(Prompt 库为空)'); return; }
      const files = fs.readdirSync(promptDir).filter((f) => f.endsWith('.md'));
      const matched = files.filter((f) => {
        const c = fs.readFileSync(path.join(promptDir, f), 'utf-8');
        return c.includes(name) || f.includes(name);
      });
      if (matched.length === 0) { console.log(`(未找到 "${name}")`); return; }
      console.log(`\n🔍 匹配的 Prompt:\n`);
      matched.forEach((f) => console.log(`  ${f.replace('.md', '')}`));
      console.log('');
    } else {
      console.error(`\n❌ 未知操作: ${action}（支持: add | list | search | show）\n`);
      process.exit(1);
    }
  });

// ─── scaffold ─────────────────────────────────────────────────────────────────
program
  .command('scaffold')
  .description('黄金路径脚手架：生成项目模板结构提示词')
  .option('--template <name>', '模板名称：react-ts | node-api | cli-tool | monorepo | library', '')
  .option('--list', '列出所有可用模板', false)
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { template: string; list: boolean; copy: boolean }) => {
    const templates: Record<string, string> = {
      'react-ts':
        `React + TypeScript + Vite + Vitest + Tailwind CSS\n` +
        `目录：src/components/ src/hooks/ src/pages/ src/store/ src/types/ src/utils/`,
      'node-api':
        `Node.js + TypeScript + Express/Fastify + Prisma + Jest\n` +
        `目录：src/routes/ src/services/ src/models/ src/middleware/ src/utils/ tests/`,
      'cli-tool':
        `Node.js CLI + TypeScript + Commander + Vitest\n` +
        `目录：src/commands/ src/utils/ src/types/ tests/ dist/`,
      'monorepo':
        `pnpm Monorepo + Turborepo + TypeScript\n` +
        `目录：packages/ui/ packages/core/ packages/cli/ apps/web/ apps/docs/`,
      'library':
        `TypeScript Library + Vitest + tsup + Changesets\n` +
        `目录：src/ tests/ examples/ dist/`,
    };

    if (options.list) {
      console.log('\n📦 可用脚手架模板:\n');
      Object.entries(templates).forEach(([name, desc]) => {
        console.log(`  ${name.padEnd(12)} ${desc.split('\n')[0]}`);
      });
      console.log('\n用法：ethan scaffold --template react-ts\n');
      return;
    }

    const tmpl = options.template || 'react-ts';
    const desc = templates[tmpl] ?? `自定义模板: ${tmpl}`;
    const prompt =
      `# 项目脚手架：${tmpl}\n\n` +
      `**模板**: ${desc}\n\n` +
      `## 请生成完整的项目初始结构：\n\n` +
      `1. **目录结构**（tree 格式，含说明注释）\n` +
      `2. **核心配置文件**：package.json / tsconfig.json / vite.config.ts（或对应工具）\n` +
      `3. **代码规范配置**：ESLint + Prettier + .editorconfig\n` +
      `4. **Git 配置**：.gitignore / .husky / commitlint\n` +
      `5. **CI 配置**：GitHub Actions（lint + test + build）\n` +
      `6. **入口文件**：最小可运行的 index.ts\n` +
      `7. **README 模板**：含徽章、快速启动、贡献指南链接\n\n` +
      `> 基于 2025 年最佳实践，使用最新稳定版本的依赖。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ 脚手架提示词已复制（${tmpl}）\n`);
    } else {
      console.log(prompt);
    }
  });

// ─── benchmark ────────────────────────────────────────────────────────────────
program
  .command('benchmark')
  .description('生成 Skill 质量基准报告')
  .option('--skill <id>', '指定 Skill ID 分析', '')
  .option('--no-copy', '不复制到剪贴板', false)
  .action(async (options: { skill: string; copy: boolean }) => {
    const statsPath = path.join(os.homedir(), '.ethan-stats.json');
    let statsData: Record<string, unknown> = {};
    if (fs.existsSync(statsPath)) {
      try { statsData = JSON.parse(fs.readFileSync(statsPath, 'utf-8')); } catch { /* ignore */ }
    }

    const skills = await getActiveSkills();
    const ratings = (statsData.ratings ?? {}) as Record<string, number[]>;
    const usage = (statsData.usage ?? {}) as Record<string, number>;

    const targetSkills = options.skill
      ? skills.filter((s) => s.id === options.skill)
      : skills;

    const rows = targetSkills.map((s) => {
      const r = ratings[s.id] ?? [];
      const avg = r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : 'N/A';
      const uses = usage[s.id] ?? 0;
      return `| ${s.id.padEnd(25)} | ${String(uses).padStart(5)} | ${avg.toString().padStart(5)} | ${r.length} |`;
    });

    const report =
      `# Skill 质量基准报告\n\n` +
      `| Skill ID                  | 使用次数 | 平均评分 | 评分数 |\n` +
      `|---------------------------|---------|---------|--------|\n` +
      rows.join('\n') + '\n\n' +
      `> 数据来源：~/.ethan-stats.json`;

    if (options.copy !== false) {
      copyToClipboard(report);
      console.log('\n✅ 基准报告已复制到剪贴板\n');
    } else {
      console.log(report);
    }
  });

// ─── sync ─────────────────────────────────────────────────────────────────────
program
  .command('sync <action>')
  .description('配置同步：push（推送到 git）| pull（从 git 拉取）')
  .action((action: string) => {
    const syncBranch = 'ethan-config';
    const ethanDir = path.join(process.cwd(), '.ethan');
    if (!isGitRepo(process.cwd())) {
      console.error('\n❌ 当前目录不是 git 仓库\n');
      process.exit(1);
    }
    if (action === 'push') {
      // Add .ethan/ to git and push to a special branch
      console.log(`\n📤 同步配置到 git 分支 ${syncBranch}...\n`);
      const r1 = spawnSync('git', ['add', '.ethan/'], { cwd: process.cwd(), encoding: 'utf-8' });
      if (r1.status !== 0) { console.error('git add 失败'); process.exit(1); }
      spawnSync('git', ['commit', '-m', 'chore: sync ethan config', '--allow-empty'], {
        cwd: process.cwd(), encoding: 'utf-8',
      });
      console.log('✅ 已提交 .ethan/ 配置（注意：需手动 git push）\n');
    } else if (action === 'pull') {
      console.log(`\n📥 从 git 拉取配置...\n`);
      const r = spawnSync('git', ['pull', '--no-rebase'], { cwd: process.cwd(), encoding: 'utf-8' });
      console.log(r.stdout ?? '');
      if (r.status !== 0) { console.error(r.stderr ?? 'pull 失败'); process.exit(1); }
      if (fs.existsSync(ethanDir)) {
        console.log('✅ 配置已同步\n');
      } else {
        console.log('ℹ️  .ethan/ 目录不存在，可能尚未有配置\n');
      }
    } else {
      console.error(`\n❌ 未知操作: ${action}（支持: push | pull）\n`);
      process.exit(1);
    }
  });

// ─── compliance ───────────────────────────────────────────────────────────────
program
  .command('compliance')
  .description('生成合规证据收集提示词（soc2 / gdpr / iso27001）')
  .option('--standard <std>', '合规标准：soc2 | gdpr | iso27001', 'soc2')
  .option('--no-copy', '不复制到剪贴板', false)
  .action((options: { standard: string; copy: boolean }) => {
    const standards: Record<string, { name: string; controls: string[] }> = {
      soc2: {
        name: 'SOC 2 Type II',
        controls: [
          '**CC6.1** 逻辑访问控制：MFA、最小权限原则、访问审查记录',
          '**CC6.6** 网络安全控制：防火墙规则、TLS 加密、入侵检测',
          '**CC7.1** 系统监控：日志集中管理、异常告警、保留 90 天',
          '**CC7.2** 安全事件响应：Incident Response Plan、演练记录',
          '**A1.1** 可用性：SLA 目标、备份策略、RTO/RPO 定义',
          '**C1.1** 保密性：数据分类、加密传输存储、访问控制',
        ],
      },
      gdpr: {
        name: 'GDPR',
        controls: [
          '**Art. 13/14** 隐私政策：数据收集目的、保留期限、用户权利',
          '**Art. 17** 删除权：用户数据删除接口及执行证明',
          '**Art. 25** 隐私设计：数据最小化、假名化处理',
          '**Art. 30** 处理活动记录（ROPA）',
          '**Art. 32** 安全措施：加密、访问控制、漏洞管理',
          '**Art. 33** 数据泄露通知流程：72 小时内报告机制',
        ],
      },
      iso27001: {
        name: 'ISO 27001:2022',
        controls: [
          '**A.5** 信息安全策略：书面安全政策、年度审查',
          '**A.8** 资产管理：信息资产清单、数据分类',
          '**A.9** 访问控制：用户管理流程、定期权限审查',
          '**A.12** 运营安全：变更管理、恶意代码防护、日志监控',
          '**A.16** 信息安全事件管理：事件响应程序',
          '**A.17** 业务连续性：BCP/DRP 文档及演练',
        ],
      },
    };

    const std = standards[options.standard] ?? standards.soc2;
    const controls = std.controls.map((c) => `- ${c}`).join('\n');

    const prompt =
      `# 合规证据收集 — ${std.name}\n\n` +
      `## 需要收集的证据清单\n\n${controls}\n\n` +
      `## 证据收集任务\n\n` +
      `请为以上每项控制措施：\n\n` +
      `1. **识别现有证据**：系统中已有哪些文档/配置可作为证据\n` +
      `2. **差距分析**：缺少什么证据（❌ 表示缺失）\n` +
      `3. **证据生成建议**：如何创建缺失证据（文档模板/配置截图/脚本）\n` +
      `4. **优先级排序**：按审计风险从高到低排列\n\n` +
      `> 请基于技术实现现状（代码库、基础设施、流程文档）进行分析。`;

    if (options.copy !== false) {
      copyToClipboard(prompt);
      console.log(`\n✅ ${std.name} 合规证据提示词已复制到剪贴板\n`);
    } else {
      console.log(prompt);
    }
  });

program.parse(process.argv);
