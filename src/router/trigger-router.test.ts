import { describe, it, expect } from 'vitest';
import { routeTrigger, getTriggerMap } from './trigger-router';

describe('routeTrigger', () => {
  it('returns null for empty input', () => {
    expect(routeTrigger('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(routeTrigger('   ')).toBeNull();
  });

  it('returns null for unrecognized input', () => {
    expect(routeTrigger('this is completely unrelated input xyz')).toBeNull();
  });

  it('exact match: "需求理解" → requirement-understanding', () => {
    const result = routeTrigger('需求理解');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('requirement-understanding');
    expect(result!.confidence).toBe('exact');
  });

  it('exact match is case-insensitive', () => {
    const result = routeTrigger('Code Review');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('code-review');
    expect(result!.confidence).toBe('exact');
  });

  it('exact match: "debug" → debug skill', () => {
    const result = routeTrigger('debug');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('debug');
    expect(result!.confidence).toBe('exact');
  });

  it('exact match: "@ethan 需求" → requirement-understanding', () => {
    const result = routeTrigger('@ethan 需求');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('requirement-understanding');
  });

  it('partial match: input contains a trigger keyword', () => {
    const result = routeTrigger('帮我做一下需求理解');
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe('partial');
  });

  it('partial match: trigger is contained in a longer input', () => {
    const result = routeTrigger('我想做一个 POC 验证');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('tech-research');
  });

  it('returns the matchedTrigger field', () => {
    const result = routeTrigger('任务拆解');
    expect(result).not.toBeNull();
    expect(result!.matchedTrigger).toBeDefined();
    expect(typeof result!.matchedTrigger).toBe('string');
  });

  it('trimming: leading/trailing whitespace does not break exact match', () => {
    const result = routeTrigger('  周报  ');
    expect(result).not.toBeNull();
    expect(result!.skill.id).toBe('weekly-report');
  });
});

describe('getTriggerMap', () => {
  it('returns a Map', () => {
    expect(getTriggerMap()).toBeInstanceOf(Map);
  });

  it('map is non-empty', () => {
    expect(getTriggerMap().size).toBeGreaterThan(0);
  });

  it('all map keys are lowercase', () => {
    for (const key of getTriggerMap().keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('each map value has an id and name', () => {
    for (const skill of getTriggerMap().values()) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
    }
  });
});
