import type { SkillDefinition } from '../skills/types';
import { ALL_SKILLS } from '../skills/index';

export interface RouteResult {
  skill: SkillDefinition;
  matchedTrigger: string;
  confidence: 'exact' | 'partial';
}

/**
 * 根据用户输入路由到对应 Skill
 * 优先精确匹配，其次模糊匹配
 */
export function routeTrigger(input: string): RouteResult | null {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0) return null;

  // 精确匹配：输入完全等于某个触发词
  for (const skill of ALL_SKILLS) {
    for (const trigger of skill.triggers) {
      if (normalized === trigger.toLowerCase()) {
        return { skill, matchedTrigger: trigger, confidence: 'exact' };
      }
    }
  }

  // 部分匹配：输入包含触发词，或触发词包含在输入中
  for (const skill of ALL_SKILLS) {
    for (const trigger of skill.triggers) {
      const t = trigger.toLowerCase();
      if (normalized.includes(t) || t.includes(normalized)) {
        return { skill, matchedTrigger: trigger, confidence: 'partial' };
      }
    }
  }

  return null;
}

/**
 * 获取所有触发词映射表（用于展示和调试）
 */
export function getTriggerMap(): Map<string, SkillDefinition> {
  const map = new Map<string, SkillDefinition>();
  for (const skill of ALL_SKILLS) {
    for (const trigger of skill.triggers) {
      map.set(trigger.toLowerCase(), skill);
    }
  }
  return map;
}
