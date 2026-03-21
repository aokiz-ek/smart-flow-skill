#!/usr/bin/env node
/**
 * npx ethan CLI
 * 命令：install | list | mcp | validate | pipeline | doctor | stats
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ALL_SKILLS } from '../skills/index';
import type { Platform, BuildContext } from '../skills/types';

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

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
  .action(async (options) => {
    const { platform, dir } = options;
    const rulesDir = path.join(__dirname, '../../rules');

    const platformMap: Record<string, Array<{ src: string; dest: string }>> = {
      cursor: [
        {
          src: path.join(rulesDir, 'cursor/smart-flow.mdc'),
          dest: path.join(dir, '.cursor/rules/smart-flow.mdc'),
        },
        {
          src: path.join(rulesDir, 'cursor/.cursorrules'),
          dest: path.join(dir, '.cursorrules'),
        },
      ],
      copilot: [
        {
          src: path.join(rulesDir, 'copilot/copilot-instructions.md'),
          dest: path.join(dir, '.github/copilot-instructions.md'),
        },
      ],
      cline: [
        {
          src: path.join(rulesDir, 'cline/.clinerules'),
          dest: path.join(dir, '.clinerules'),
        },
      ],
      lingma: [
        {
          src: path.join(rulesDir, 'lingma/smart-flow.md'),
          dest: path.join(dir, '.lingma/rules/smart-flow.md'),
        },
      ],
      codebuddy: [
        {
          src: path.join(rulesDir, 'codebuddy/CODEBUDDY.md'),
          dest: path.join(dir, 'CODEBUDDY.md'),
        },
      ],
      windsurf: [
        {
          src: path.join(rulesDir, 'windsurf/.windsurf/rules/smart-flow.md'),
          dest: path.join(dir, '.windsurf/rules/smart-flow.md'),
        },
      ],
      zed: [
        {
          src: path.join(rulesDir, 'zed/smart-flow.rules'),
          dest: path.join(dir, 'smart-flow.rules'),
        },
      ],
      jetbrains: [
        {
          src: path.join(rulesDir, 'jetbrains/smart-flow.md'),
          dest: path.join(dir, '.github/ai-instructions.md'),
        },
      ],
      continue: [
        {
          src: path.join(rulesDir, 'continue/.continuerules'),
          dest: path.join(dir, '.continuerules'),
        },
      ],
      'claude-code': [
        {
          src: path.join(rulesDir, 'claude-code/CLAUDE.md'),
          dest: path.join(dir, 'CLAUDE.md'),
        },
      ],
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
      fs.copyFileSync(src, dest);
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
  .description('列出所有可用 Skill')
  .option('--json', '以 JSON 格式输出')
  .action((options) => {
    if (options.json) {
      console.log(
        JSON.stringify(
          ALL_SKILLS.map((s) => ({
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
    for (const skill of ALL_SKILLS) {
      const categoryTag = skill.category ? ` [${skill.category}]` : '';
      console.log(`\n${skill.order}. ${skill.name} (${skill.id})${categoryTag}`);
      console.log(`   ${skill.description}`);
      console.log(`   Triggers: ${skill.triggers.slice(0, 3).join(' | ')}`);
    }
    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${ALL_SKILLS.length} skills`);
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

program.parse(process.argv);
