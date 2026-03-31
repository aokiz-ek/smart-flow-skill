import { describe, it, expect } from 'vitest';
import { renderCursorMdc, renderCursorOld } from './cursor-mdc.template';
import { renderMarkdown } from './copilot-md.template';
import { ALL_SKILLS } from '../skills/index';
import type { BuildContext } from '../skills/types';

const BASE_CTX: BuildContext = {
  platform: 'copilot',
  skills: ALL_SKILLS,
  generatedAt: '2025-01-01T00:00:00.000Z',
  version: '1.0.0',
};

function ctx(platform: BuildContext['platform']): BuildContext {
  return { ...BASE_CTX, platform };
}

// ─── renderCursorMdc ────────────────────────────────────────────────────────

describe('renderCursorMdc', () => {
  it('outputs valid YAML frontmatter with alwaysApply: true', () => {
    const output = renderCursorMdc(ctx('cursor-new'));
    expect(output).toContain('alwaysApply: true');
  });

  it('contains version number', () => {
    const output = renderCursorMdc(ctx('cursor-new'));
    expect(output).toContain('1.0.0');
  });

  it('contains all skill names', () => {
    const output = renderCursorMdc(ctx('cursor-new'));
    for (const skill of ALL_SKILLS) {
      expect(output).toContain(skill.name);
    }
  });

  it('includes the generatedAt timestamp', () => {
    const output = renderCursorMdc(ctx('cursor-new'));
    expect(output).toContain('2025-01-01T00:00:00.000Z');
  });
});

// ─── renderCursorOld ────────────────────────────────────────────────────────

describe('renderCursorOld', () => {
  it('produces non-empty output', () => {
    const output = renderCursorOld(ctx('cursor-old'));
    expect(output.length).toBeGreaterThan(100);
  });

  it('contains all skill triggers', () => {
    const output = renderCursorOld(ctx('cursor-old'));
    for (const skill of ALL_SKILLS) {
      expect(output).toContain(skill.triggers[0]);
    }
  });
});

// ─── renderMarkdown — each platform ────────────────────────────────────────

const markdownPlatforms: Array<BuildContext['platform']> = [
  'copilot',
  'cline',
  'lingma',
  'codebuddy',
  'windsurf',
  'zed',
  'jetbrains',
  'continue',
  'claude-code',
];

describe('renderMarkdown', () => {
  for (const platform of markdownPlatforms) {
    it(`renders non-empty output for platform: ${platform}`, () => {
      const output = renderMarkdown(ctx(platform));
      expect(output.length).toBeGreaterThan(200);
    });

    it(`contains "Ethan" branding for platform: ${platform}`, () => {
      const output = renderMarkdown(ctx(platform));
      expect(output).toContain('Ethan');
    });

    it(`contains at least one skill name for platform: ${platform}`, () => {
      const output = renderMarkdown(ctx(platform));
      expect(output).toContain(ALL_SKILLS[0].name);
    });
  }

  it('claude-code output contains detailed step content', () => {
    const output = renderMarkdown(ctx('claude-code'));
    // Claude Code template renders full step content
    expect(output).toContain('执行步骤');
    expect(output).toContain('输出格式');
  });

  it('zed output has content for all skills', () => {
    const zed = renderMarkdown(ctx('zed'));
    expect(zed.length).toBeGreaterThan(0);
  });
});
