/**
 * 项目技术栈自动检测
 * 扫描项目文件识别框架、语言、工具，生成上下文块注入规则文件
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectContext {
  /** 检测到的框架/库列表 */
  frameworks: string[];
  /** 编程语言 */
  languages: string[];
  /** 构建/包管理工具 */
  tools: string[];
  /** 项目名称 */
  projectName?: string;
  /** 简要描述（供 AI 理解的上下文） */
  summary: string;
}

/**
 * 扫描项目目录，返回检测到的技术栈上下文
 */
export function detectProjectContext(cwd: string = process.cwd()): ProjectContext {
  const frameworks: string[] = [];
  const languages: string[] = [];
  const tools: string[] = [];
  let projectName: string | undefined;

  // 读取 package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name;
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };

      // 前端框架
      if (allDeps['next']) frameworks.push('Next.js');
      else if (allDeps['react']) frameworks.push('React');
      if (allDeps['vue']) frameworks.push('Vue');
      if (allDeps['nuxt']) frameworks.push('Nuxt.js');
      if (allDeps['svelte']) frameworks.push('Svelte');
      if (allDeps['@angular/core']) frameworks.push('Angular');
      if (allDeps['solid-js']) frameworks.push('SolidJS');

      // 后端框架
      if (allDeps['express']) frameworks.push('Express');
      if (allDeps['fastify']) frameworks.push('Fastify');
      if (allDeps['koa']) frameworks.push('Koa');
      if (allDeps['hono']) frameworks.push('Hono');
      if (allDeps['nestjs'] || allDeps['@nestjs/core']) frameworks.push('NestJS');

      // 样式
      if (allDeps['tailwindcss']) frameworks.push('Tailwind CSS');
      if (allDeps['@mui/material']) frameworks.push('Material UI');
      if (allDeps['antd']) frameworks.push('Ant Design');
      if (allDeps['@chakra-ui/react']) frameworks.push('Chakra UI');

      // 状态管理
      if (allDeps['zustand']) tools.push('Zustand');
      if (allDeps['pinia']) tools.push('Pinia');
      if (allDeps['redux'] || allDeps['@reduxjs/toolkit']) tools.push('Redux');
      if (allDeps['mobx']) tools.push('MobX');
      if (allDeps['jotai']) tools.push('Jotai');

      // 数据库/ORM
      if (allDeps['prisma']) tools.push('Prisma');
      if (allDeps['typeorm']) tools.push('TypeORM');
      if (allDeps['drizzle-orm']) tools.push('Drizzle ORM');
      if (allDeps['mongoose']) tools.push('Mongoose');
      if (allDeps['sequelize']) tools.push('Sequelize');

      // 测试
      if (allDeps['vitest']) tools.push('Vitest');
      if (allDeps['jest']) tools.push('Jest');
      if (allDeps['@playwright/test'] || allDeps['playwright']) tools.push('Playwright');
      if (allDeps['cypress']) tools.push('Cypress');

      // 构建工具
      if (allDeps['vite']) tools.push('Vite');
      if (allDeps['webpack']) tools.push('Webpack');
      if (allDeps['turbo'] || allDeps['turborepo']) tools.push('Turborepo');

      // TypeScript
      if (allDeps['typescript']) languages.push('TypeScript');
    } catch {
      // ignore
    }
  }

  // 检查文件确认语言/框架
  if (!languages.includes('TypeScript')) {
    if (
      fs.existsSync(path.join(cwd, 'tsconfig.json')) ||
      fs.existsSync(path.join(cwd, 'tsconfig.base.json'))
    ) {
      languages.push('TypeScript');
    }
  }

  if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'setup.py'))
  ) {
    languages.push('Python');
    if (fs.existsSync(path.join(cwd, 'manage.py'))) frameworks.push('Django');
    if (fs.existsSync(path.join(cwd, 'app.py'))) frameworks.push('Flask/FastAPI');
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    languages.push('Go');
  }

  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    languages.push('Rust');
  }

  if (fs.existsSync(path.join(cwd, 'pom.xml')) || fs.existsSync(path.join(cwd, 'build.gradle'))) {
    languages.push('Java');
    if (fs.existsSync(path.join(cwd, 'src/main/resources/application.yml'))) {
      frameworks.push('Spring Boot');
    }
  }

  // JavaScript（默认，如果没有其他语言）
  if (languages.length === 0 && fs.existsSync(path.join(cwd, 'package.json'))) {
    languages.push('JavaScript');
  }

  // 包管理器检测
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) tools.push('pnpm');
  else if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) tools.push('Bun');
  else if (fs.existsSync(path.join(cwd, 'yarn.lock'))) tools.push('Yarn');

  // 构建摘要
  const allTech = [...frameworks, ...languages, ...tools];
  const summary =
    allTech.length > 0
      ? `项目技术栈：${allTech.join(', ')}`
      : '未检测到特定技术栈';

  return { frameworks, languages, tools, projectName, summary };
}

/**
 * 将项目上下文格式化为规则文件头部注入块
 */
export function formatContextBlock(ctx: ProjectContext, lang: 'zh' | 'en' = 'zh'): string {
  const { frameworks, languages, tools, projectName, summary } = ctx;

  if (lang === 'en') {
    const lines = [
      '<!-- Auto-injected project context by ethan install --auto-context -->',
      '## Project Context',
      '',
    ];
    if (projectName) lines.push(`**Project**: ${projectName}`);
    if (languages.length) lines.push(`**Languages**: ${languages.join(', ')}`);
    if (frameworks.length) lines.push(`**Frameworks**: ${frameworks.join(', ')}`);
    if (tools.length) lines.push(`**Tools**: ${tools.join(', ')}`);
    lines.push('', '<!-- End of auto-injected context -->', '');
    return lines.join('\n');
  }

  const lines = [
    '<!-- 由 ethan install --auto-context 自动注入的项目上下文 -->',
    '## 项目上下文',
    '',
  ];
  if (projectName) lines.push(`**项目名称**：${projectName}`);
  if (languages.length) lines.push(`**编程语言**：${languages.join('、')}`);
  if (frameworks.length) lines.push(`**框架/库**：${frameworks.join('、')}`);
  if (tools.length) lines.push(`**工具链**：${tools.join('、')}`);
  if (!frameworks.length && !languages.length) lines.push(`**备注**：${summary}`);
  lines.push('', '<!-- 项目上下文结束 -->', '');
  return lines.join('\n');
}
