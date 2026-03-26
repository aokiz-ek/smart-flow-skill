import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadCustomSkills,
  generateSkillTemplate,
  generateMdSkillTemplate,
} from './custom-skill-loader';

// ─── helpers ──────────────────────────────────────────────────────────────────

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ethan-loader-'));
}

function writeSkillFile(dir: string, filename: string, content: string) {
  const skillsDir = path.join(dir, '.ethan', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(path.join(skillsDir, filename), content, 'utf-8');
}

// ─── YAML loader (existing) ───────────────────────────────────────────────────

describe('loadCustomSkills — YAML', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns [] when .ethan/skills does not exist', () => {
    expect(loadCustomSkills(tmpDir)).toEqual([]);
  });

  it('loads a valid YAML skill', () => {
    writeSkillFile(tmpDir, 'test.yaml', generateSkillTemplate());
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('my-custom-skill');
    expect(skills[0].order).toBe(100);
  });

  it('warns and skips invalid YAML skill (missing required field)', () => {
    writeSkillFile(tmpDir, 'bad.yaml', 'id: only-id\nname: X\n');
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(0);
  });
});

// ─── Markdown loader (new) ────────────────────────────────────────────────────

const VALID_MD = `---
id: md-skill
name: MD 技能
nameEn: md_skill
description: Markdown 格式的测试 Skill
triggers:
  - md 技能
  - md skill
outputFormat: Markdown 文档
order: 101
---

## 1. 第一步

- 步骤说明 A
- 步骤说明 B

## 2. 第二步

详细内容...
`;

describe('loadCustomSkills — Markdown (.md)', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('loads a valid .md skill with frontmatter + body steps', () => {
    writeSkillFile(tmpDir, 'test.md', VALID_MD);
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(1);
    const s = skills[0];
    expect(s.id).toBe('md-skill');
    expect(s.name).toBe('MD 技能');
    expect(s.nameEn).toBe('md_skill');
    expect(s.order).toBe(101);
    expect(s.triggers).toContain('md skill');
  });

  it('parses body steps from ## headings', () => {
    writeSkillFile(tmpDir, 'test.md', VALID_MD);
    const skills = loadCustomSkills(tmpDir);
    expect(skills[0].steps).toHaveLength(2);
    expect(skills[0].steps[0].title).toBe('1. 第一步');
    expect(skills[0].steps[0].content).toContain('步骤说明 A');
    expect(skills[0].steps[1].title).toBe('2. 第二步');
  });

  it('warns and skips .md without frontmatter', () => {
    writeSkillFile(tmpDir, 'no-fm.md', '## Step 1\n\ncontent\n');
    expect(loadCustomSkills(tmpDir)).toHaveLength(0);
  });

  it('warns and skips .md missing required fields in frontmatter', () => {
    writeSkillFile(tmpDir, 'missing.md', '---\nid: x\nname: X\n---\n\n## Step\nok\n');
    expect(loadCustomSkills(tmpDir)).toHaveLength(0);
  });

  it('falls back to frontmatter steps when body has no ## headings', () => {
    const mdWithFmSteps = `---
id: fm-steps-skill
name: FM Steps
nameEn: fm_steps_skill
description: fallback test
triggers:
  - fm steps
outputFormat: doc
steps:
  - title: "Step from FM"
    content: "From frontmatter"
---

This body has no headings, just prose.
`;
    writeSkillFile(tmpDir, 'fmsteps.md', mdWithFmSteps);
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].steps[0].title).toBe('Step from FM');
  });

  it('body steps take precedence over frontmatter steps when both present', () => {
    const md = `---
id: both-steps
name: Both
nameEn: both_steps
description: test
triggers:
  - both
outputFormat: doc
steps:
  - title: "FM Step"
    content: "should be ignored"
---

## Body Step

body step content
`;
    writeSkillFile(tmpDir, 'both.md', md);
    const skills = loadCustomSkills(tmpDir);
    expect(skills[0].steps[0].title).toBe('Body Step');
  });

  it('loads both .yaml and .md files from the same directory', () => {
    writeSkillFile(tmpDir, 'yaml-skill.yaml', generateSkillTemplate());
    writeSkillFile(tmpDir, 'md-skill.md', VALID_MD);
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(2);
    const ids = skills.map((s) => s.id);
    expect(ids).toContain('my-custom-skill');
    expect(ids).toContain('md-skill');
  });
});

// ─── generateMdSkillTemplate ──────────────────────────────────────────────────

describe('generateMdSkillTemplate', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns a non-empty string starting with ---', () => {
    const tpl = generateMdSkillTemplate();
    expect(typeof tpl).toBe('string');
    expect(tpl.startsWith('---')).toBe(true);
  });

  it('generated template is parseable and produces a valid skill after editing', () => {
    // Replace placeholder values with valid data
    const filled = generateMdSkillTemplate()
      .replace('id: my-custom-skill', 'id: tpl-test')
      .replace('name: 自定义技能', 'name: 模板测试')
      .replace('nameEn: my_custom_skill', 'nameEn: tpl_test')
      .replace('description: 一句话描述这个 Skill 的作用', 'description: template test');

    writeSkillFile(tmpDir, 'tpl-test.md', filled);
    const skills = loadCustomSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('tpl-test');
    expect(skills[0].steps.length).toBeGreaterThanOrEqual(1);
  });
});
