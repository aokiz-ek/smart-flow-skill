#!/usr/bin/env node
/**
 * npx ethan CLI
 * 命令：install | list | mcp | validate | pipeline | doctor | stats | init | run | workflow
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

// ─── 剪贴板工具函数（不经过 shell，避免 backtick 命令注入） ─────────────────
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'darwin') {
      spawnSync('pbcopy', [], { input: text, encoding: 'utf-8' });
      return true;
    } else if (process.platform === 'win32') {
      spawnSync('clip', [], { input: text, encoding: 'utf-8', shell: false });
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
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

function writeStats(stats: Record<string, number>): void {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
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
  .description('在 .ethan/skills/ 目录生成自定义 Skill YAML 模板')
  .action(async (name?: string) => {
    const { generateSkillTemplate } = await import('../loader/custom-skill-loader');
    const skillsDir = path.join(process.cwd(), '.ethan/skills');
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });

    const filename = name ? `${name}.yaml` : 'my-skill.yaml';
    const filePath = path.join(skillsDir, filename);

    if (fs.existsSync(filePath)) {
      console.log(`⚠️  文件已存在：${filePath}`);
      return;
    }

    fs.writeFileSync(filePath, generateSkillTemplate(), 'utf-8');
    console.log(`\n✅ 已创建自定义 Skill 模板：${filePath}`);
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
  .description('列出所有可用 Pipeline')
  .action(async () => {
    const { PIPELINES } = await import('../skills/pipeline');
    console.log('\nEthan Pipelines\n');
    console.log('─'.repeat(60));
    for (const p of PIPELINES) {
      console.log(`\n${p.id}`);
      console.log(`  名称：${p.name}`);
      console.log(`  描述：${p.description}`);
      console.log(`  Skills：${p.skillIds.join(' → ')}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${PIPELINES.length} pipelines`);
  });

pipelineCmd
  .command('run <name>')
  .description('按 Pipeline 顺序执行各 Skill 提示')
  .option('-c, --context <context>', '输入上下文', '')
  .action(async (name: string, options: { context: string }) => {
    const { resolvePipeline } = await import('../skills/pipeline');
    const resolved = resolvePipeline(name);

    if (!resolved) {
      const { PIPELINES } = await import('../skills/pipeline');
      console.error(`Unknown pipeline: ${name}`);
      console.error(`Available: ${PIPELINES.map((p) => p.id).join(' | ')}`);
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

// ─── stats 命令 ─────────────────────────────────────────────────────────────
program
  .command('stats')
  .description('查看 Skill 使用频次统计')
  .option('--reset', '清空统计数据')
  .action((options) => {
    if (options.reset) {
      writeStats({});
      console.log('✅ 统计数据已清空');
      return;
    }

    const stats = readStats();
    const entries = Object.entries(stats).sort(([, a], [, b]) => b - a);

    if (entries.length === 0) {
      console.log('\n📊 暂无使用记录（运行 pipeline run 命令后将记录使用频次）\n');
      return;
    }

    const maxCount = Math.max(...entries.map(([, v]) => v));
    const BAR_WIDTH = 30;

    console.log('\n📊 Ethan Skill 使用频次\n');
    console.log('─'.repeat(60));

    for (const [skillId, count] of entries) {
      const skill = ALL_SKILLS.find((s) => s.id === skillId);
      const name = skill ? skill.name : skillId;
      const barLen = Math.round((count / maxCount) * BAR_WIDTH);
      const bar = '█'.repeat(barLen);
      const label = name.padEnd(12);
      console.log(`  ${label} ${bar} ${count}`);
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    console.log('─'.repeat(60));
    console.log(`  Total executions: ${total}\n`);
  });

// ─── serve 命令（Web UI Dashboard） ─────────────────────────────────────────
program
  .command('serve')
  .description('启动本地 Web UI Dashboard（默认端口 3000）')
  .option('--port <port>', '监听端口', '3000')
  .action(async (options) => {
    const port = parseInt(options.port, 10) || 3000;
    const { startDashboardServer } = await import('../server/dashboard');
    startDashboardServer(port);
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
  .description('启动工作流会话（默认 dev-workflow），输出第一步提示词')
  .option('-c, --context <context>', '初始任务上下文', '')
  .action(async (pipelineId: string | undefined, options: { context: string }) => {
    const {
      loadSession,
      createSession,
      buildStepPrompt,
      calcProgress,
    } = await import('../workflow/state');
    const { resolvePipeline, PIPELINES } = await import('../skills/pipeline');

    // 检查是否已有进行中的 session
    const existing = loadSession(process.cwd());
    if (existing && !existing.completed) {
      console.log('\n⚠️  已有进行中的工作流：');
      console.log(`   Pipeline: ${existing.pipelineName}`);
      console.log(`   进度: ${calcProgress(existing)}%`);
      console.log('\n💡 使用 ethan workflow status 查看进度');
      console.log('   使用 ethan workflow reset 重置后再启动新工作流\n');
      return;
    }

    const id = pipelineId ?? 'dev-workflow';
    const resolved = resolvePipeline(id);

    if (!resolved) {
      console.error(`Unknown pipeline: ${id}`);
      console.error(`Available: ${PIPELINES.map((p) => p.id).join(' | ')}`);
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

    const session = createSession(pipeline, context, process.cwd());
    const firstStep = session.steps[0];
    const firstSkill = skills[0];

    console.log(`\n🚀 工作流已启动：${pipeline.name}`);
    console.log(`   ID: ${session.id}`);
    console.log(`   共 ${session.steps.length} 步\n`);
    console.log('─'.repeat(60));

    const prompt = buildStepPrompt(session, firstStep, firstSkill);
    console.log('\n' + prompt + '\n');
    console.log('─'.repeat(60));

    // 复制到剪贴板
    if (copyToClipboard(prompt)) {
      console.log('\n✅ 提示词已复制到剪贴板！粘贴到你的 AI 编辑器中执行。');
    }

    console.log(`\n💡 完成本步后，运行：ethan workflow done "你的本步摘要"\n`);

    // 记录使用统计
    const stats = readStats();
    stats[firstSkill.id] = (stats[firstSkill.id] || 0) + 1;
    writeStats(stats);
  });

workflowCmd
  .command('done [summary]')
  .description('完成当前步骤，传入本步摘要，自动推进到下一步')
  .action(async (summary: string | undefined) => {
    const {
      loadSession,
      markStepDone,
      buildStepPrompt,
      getCurrentStep,
      getCurrentStepIndex,
      calcProgress,
    } = await import('../workflow/state');
    const { resolvePipeline } = await import('../skills/pipeline');

    const session = loadSession(process.cwd());
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

    // 获取摘要（命令行参数 or 交互输入）
    let stepSummary = summary?.trim() ?? '';
    if (!stepSummary) {
      const readline = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));
      const currentIdx = getCurrentStepIndex(session);
      console.log(`\n✅ 完成第 ${currentIdx + 1} 步：${currentStep.skillId}`);
      stepSummary = await ask('请输入本步执行摘要（将作为下一步的上下文）：\n> ');
      rl.close();
      if (!stepSummary) {
        console.error('\n❌ 摘要不能为空\n');
        process.exit(1);
      }
    }

    const nextStep = markStepDone(session, stepSummary, process.cwd());
    const progress = calcProgress(session);

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

    console.log(`\n💡 完成本步后，运行：ethan workflow done "你的本步摘要"\n`);

    // 记录使用统计
    const stats = readStats();
    stats[nextSkill.id] = (stats[nextSkill.id] || 0) + 1;
    writeStats(stats);
  });

workflowCmd
  .command('status')
  .description('查看当前工作流进度看板')
  .action(async () => {
    const {
      loadSession,
      getCurrentStepIndex,
      calcProgress,
    } = await import('../workflow/state');

    const session = loadSession(process.cwd());
    if (!session) {
      console.log('\n📋 当前目录暂无工作流会话。\n');
      console.log('   ��行 ethan workflow start 启动新工作流\n');
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
      console.log(`   完成当前步骤后运行：ethan workflow done "你的摘要"\n`);
    }
  });

workflowCmd
  .command('reset')
  .description('清除当前工作流会话（不可恢复）')
  .action(async () => {
    const { loadSession, deleteSession, calcProgress } = await import('../workflow/state');

    const session = loadSession(process.cwd());
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

    deleteSession(process.cwd());
    console.log('\n✅ 工作流已重置。运行 ethan workflow start 开始新工作流。\n');
  });

workflowCmd
  .command('list')
  .description('列出所有可用的工作流 Pipeline')
  .action(async () => {
    const { PIPELINES } = await import('../skills/pipeline');
    const { loadSession, calcProgress } = await import('../workflow/state');

    const current = loadSession(process.cwd());

    console.log('\n🔄 可用工作流\n');
    console.log('─'.repeat(60));
    for (const p of PIPELINES) {
      const isCurrent = current?.pipelineId === p.id && !current.completed;
      const tag = isCurrent ? ` ◀ 进行中（${calcProgress(current!)}%）` : '';
      console.log(`\n  ${p.id}${tag}`);
      console.log(`  名称：${p.name}`);
      console.log(`  描述：${p.description}`);
      console.log(`  步骤：${p.skillIds.join(' → ')}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log('\n启动工作流：ethan workflow start <pipeline-id> -c "任务描述"\n');
  });

program.parse(process.argv);
