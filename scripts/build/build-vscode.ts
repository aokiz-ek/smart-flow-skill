#!/usr/bin/env ts-node
/**
 * VS Code 扩展打包脚本
 * 运行：npx ts-node scripts/build/build-vscode.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const VSCODE_DIR = path.join(ROOT, 'vscode-extension');

async function main(): Promise<void> {
  console.log('\n📦 Building VS Code extension...\n');

  // 检查 vsce 是否安装
  try {
    execSync('npx vsce --version', { stdio: 'pipe' });
  } catch {
    console.log('Installing @vscode/vsce...');
    execSync('npm install -g @vscode/vsce', { stdio: 'inherit' });
  }

  // 编译 TypeScript
  console.log('Compiling TypeScript...');
  execSync('tsc -p tsconfig.vscode.json', { cwd: ROOT, stdio: 'inherit' });

  // 复制 package.json 到 vscode-extension/
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const vscodePkg = JSON.parse(
    fs.readFileSync(path.join(VSCODE_DIR, 'package.json'), 'utf-8')
  );
  vscodePkg.version = pkg.version;
  fs.writeFileSync(
    path.join(VSCODE_DIR, 'package.json'),
    JSON.stringify(vscodePkg, null, 2)
  );

  // 打包 .vsix
  console.log('Packaging .vsix...');
  execSync('npx vsce package --no-dependencies', { cwd: VSCODE_DIR, stdio: 'inherit' });

  // 移动到 dist/
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const vsixFiles = fs.readdirSync(VSCODE_DIR).filter((f) => f.endsWith('.vsix'));
  for (const file of vsixFiles) {
    fs.renameSync(path.join(VSCODE_DIR, file), path.join(distDir, file));
    console.log(`  ✅  dist/${file}`);
  }

  console.log('\n✨  VS Code extension built successfully!');
}

main().catch((err) => {
  console.error('❌  VS Code build failed:', err);
  process.exit(1);
});
