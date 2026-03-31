import { describe, it, expect } from 'vitest';
import { ALL_SKILLS } from './index';
import { PIPELINES, resolvePipeline } from './pipeline';

// ─── ALL_SKILLS 基础契约 ────────────────────────────────────────────────────

describe('ALL_SKILLS', () => {
  it('should contain exactly 14 skills', () => {
    expect(ALL_SKILLS).toHaveLength(14);
  });

  it('should have unique ids', () => {
    const ids = ALL_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique nameEn values', () => {
    const names = ALL_SKILLS.map((s) => s.nameEn);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have sequential order numbers starting from 1', () => {
    const orders = ALL_SKILLS.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('every skill should have at least one trigger', () => {
    for (const skill of ALL_SKILLS) {
      expect(skill.triggers.length, `${skill.id} should have triggers`).toBeGreaterThan(0);
    }
  });

  it('every skill should have at least one step', () => {
    for (const skill of ALL_SKILLS) {
      expect(skill.steps.length, `${skill.id} should have steps`).toBeGreaterThan(0);
    }
  });

  it('every step should have non-empty title and content', () => {
    for (const skill of ALL_SKILLS) {
      for (const step of skill.steps) {
        expect(step.title.trim(), `${skill.id} step title`).not.toBe('');
        expect(step.content.trim(), `${skill.id} step content`).not.toBe('');
      }
    }
  });

  it('skills with nextSkill should reference a valid skill id', () => {
    const ids = new Set(ALL_SKILLS.map((s) => s.id));
    for (const skill of ALL_SKILLS) {
      if (skill.nextSkill) {
        expect(ids.has(skill.nextSkill), `${skill.id}.nextSkill="${skill.nextSkill}" is invalid`).toBe(true);
      }
    }
  });

  it('all categories should be valid values when set', () => {
    const validCategories = new Set(['需求侧', '执行侧', '跟踪侧', '输出侧', '质量侧']);
    for (const skill of ALL_SKILLS) {
      if (skill.category) {
        expect(validCategories.has(skill.category), `${skill.id}.category is invalid`).toBe(true);
      }
    }
  });
});

// ─── PIPELINES ──────────────────────────────────────────────────────────────

describe('PIPELINES', () => {
  it('should have at least one pipeline', () => {
    expect(PIPELINES.length).toBeGreaterThan(0);
  });

  it('should have unique pipeline ids', () => {
    const ids = PIPELINES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pipeline should reference valid skill ids', () => {
    const skillIds = new Set(ALL_SKILLS.map((s) => s.id));
    for (const pipeline of PIPELINES) {
      for (const skillId of pipeline.skillIds) {
        expect(skillIds.has(skillId), `Pipeline "${pipeline.id}" references unknown skill "${skillId}"`).toBe(true);
      }
    }
  });

  it('every pipeline should have at least 2 skills', () => {
    for (const pipeline of PIPELINES) {
      expect(pipeline.skillIds.length, `${pipeline.id} needs ≥2 skills`).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── resolvePipeline ────────────────────────────────────────────────────────

describe('resolvePipeline', () => {
  it('returns null for unknown pipeline id', () => {
    expect(resolvePipeline('non-existent')).toBeNull();
  });

  it('resolves dev-workflow correctly', () => {
    const result = resolvePipeline('dev-workflow');
    expect(result).not.toBeNull();
    expect(result!.pipeline.id).toBe('dev-workflow');
    expect(result!.skills.length).toBeGreaterThan(0);
  });

  it('resolved skills match the pipeline skillIds order', () => {
    for (const pipeline of PIPELINES) {
      const result = resolvePipeline(pipeline.id);
      expect(result).not.toBeNull();
      const resolvedIds = result!.skills.map((s) => s.id);
      expect(resolvedIds).toEqual(pipeline.skillIds);
    }
  });
});
