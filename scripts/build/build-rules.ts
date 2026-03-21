#!/usr/bin/env ts-node
/**
 * 核心构建脚本：从 src/skills/ 生成所有平台规则文件
 * 运行：npx ts-node scripts/build/build-rules.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ALL_SKILLS } from '../../src/skills/index';
import { BuildContext } from '../../src/skills/types';
import { renderCursorMdc, renderCursorOld } from '../../src/templates/cursor-mdc.template';
import { renderMarkdown } from '../../src/templates/copilot-md.template';

const ROOT = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const VERSION: string = pkg.version;
const GENERATED_AT = new Date().toISOString();

function makeCtx(platform: BuildContext['platform']): BuildContext {
  return {
    platform,
    skills: ALL_SKILLS,
    generatedAt: GENERATED_AT,
    version: VERSION,
  };
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');
  console.log(`  ✅  ${path.relative(ROOT, filePath)} (${size} bytes)`);
}

async function main(): Promise<void> {
  console.log(`\n🔨 Building rules from ${ALL_SKILLS.length} skills (v${VERSION})...\n`);

  // 1. Cursor 新版（.mdc with frontmatter）
  writeFile(
    path.join(ROOT, 'rules/cursor/smart-flow.mdc'),
    renderCursorMdc(makeCtx('cursor-new'))
  );

  // 2. Cursor 旧版（.cursorrules 纯文本）
  writeFile(
    path.join(ROOT, 'rules/cursor/.cursorrules'),
    renderCursorOld(makeCtx('cursor-old'))
  );

  // 3. VS Code Copilot
  writeFile(
    path.join(ROOT, 'rules/copilot/copilot-instructions.md'),
    renderMarkdown(makeCtx('copilot'))
  );

  // 4. Cline
  writeFile(
    path.join(ROOT, 'rules/cline/.clinerules'),
    renderMarkdown(makeCtx('cline'))
  );

  // 5. 通义灵码
  writeFile(
    path.join(ROOT, 'rules/lingma/smart-flow.md'),
    renderMarkdown(makeCtx('lingma'))
  );

  // 6. 腾讯 CodeBuddy
  writeFile(
    path.join(ROOT, 'rules/codebuddy/CODEBUDDY.md'),
    renderMarkdown(makeCtx('codebuddy'))
  );

  // 7. Windsurf
  writeFile(
    path.join(ROOT, 'rules/windsurf/.windsurf/rules/smart-flow.md'),
    renderMarkdown(makeCtx('windsurf'))
  );

  // 8. Zed
  writeFile(
    path.join(ROOT, 'rules/zed/smart-flow.rules'),
    renderMarkdown(makeCtx('zed'))
  );

  // 9. JetBrains AI
  writeFile(
    path.join(ROOT, 'rules/jetbrains/smart-flow.md'),
    renderMarkdown(makeCtx('jetbrains'))
  );

  // 10. Continue
  writeFile(
    path.join(ROOT, 'rules/continue/.continuerules'),
    renderMarkdown(makeCtx('continue'))
  );

  // 11. Claude Code
  writeFile(
    path.join(ROOT, 'rules/claude-code/CLAUDE.md'),
    renderMarkdown(makeCtx('claude-code'))
  );

  console.log('\n✨  All rules generated successfully!\n');
  console.log('📁  Output directory: rules/');
  console.log('   rules/cursor/smart-flow.mdc                    → Cursor 新版');
  console.log('   rules/cursor/.cursorrules                      → Cursor 旧版');
  console.log('   rules/copilot/copilot-instructions.md          → VS Code Copilot');
  console.log('   rules/cline/.clinerules                        → Cline');
  console.log('   rules/lingma/smart-flow.md                     → 通义灵码');
  console.log('   rules/codebuddy/CODEBUDDY.md                   → 腾讯 CodeBuddy');
  console.log('   rules/windsurf/.windsurf/rules/smart-flow.md   → Windsurf');
  console.log('   rules/zed/smart-flow.rules                     → Zed');
  console.log('   rules/jetbrains/smart-flow.md                  → JetBrains AI');
  console.log('   rules/continue/.continuerules                  → Continue');
  console.log('   rules/claude-code/CLAUDE.md                    → Claude Code');
}

main().catch((err) => {
  console.error('❌  Build failed:', err);
  process.exit(1);
});
