import { describe, it, expect } from 'vitest';
import { buildAutopilotPrompt, buildAllPipelinesAutopilotPrompt } from './autopilot';
import { resolvePipeline, PIPELINES } from '../skills/pipeline';

describe('buildAutopilotPrompt', () => {
  const devWorkflow = resolvePipeline('dev-workflow')!;

  it('includes task context', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '实现用户登录功能',
    });
    expect(prompt).toContain('实现用户登录功能');
  });

  it('includes pipeline name and id', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt).toContain(devWorkflow.pipeline.name);
    expect(prompt).toContain(devWorkflow.pipeline.id);
  });

  it('includes all step headings in order', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    devWorkflow.skills.forEach((skill, i) => {
      expect(prompt).toContain(`步骤 ${i + 1}/${devWorkflow.skills.length}`);
      expect(prompt).toContain(skill.name);
    });
  });

  it('includes <details> fold instruction', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt).toContain('<details>');
    expect(prompt).toContain('<summary>');
  });

  it('includes "no user confirmation" instruction', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt).toContain('不等待用户确认');
  });

  it('includes prior-input reference for steps after first', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt).toContain('步骤 1 的核心产出');
  });

  it('includes context-passing rule (≤200字)', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt).toContain('200');
  });

  it('ends with start instruction', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试',
    });
    expect(prompt.trimEnd()).toMatch(/立即开始执行步骤 1[。.]?\*{0,2}$/);
  });

  it('includes merged report template', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: '测试需求',
    });
    expect(prompt).toContain('工作流执行报告');
    expect(prompt).toContain('测试需求');
    expect(prompt).toContain('Ethan Auto-Pilot');
  });

  it('generates english prompt when isEn=true', () => {
    const prompt = buildAutopilotPrompt(devWorkflow.pipeline, devWorkflow.skills, {
      context: 'implement login',
      isEn: true,
    });
    expect(prompt).toContain('Auto-Pilot Workflow Instruction');
    expect(prompt).toContain('Begin executing Step 1 now');
    expect(prompt).not.toContain('任务背景');
    expect(prompt).toContain('<details>');
  });

  it('works for all built-in pipelines', () => {
    for (const p of PIPELINES) {
      const resolved = resolvePipeline(p.id)!;
      const prompt = buildAutopilotPrompt(resolved.pipeline, resolved.skills, {
        context: '测试',
      });
      expect(prompt.length).toBeGreaterThan(500);
      expect(prompt).toContain(resolved.pipeline.name);
    }
  });
});

describe('buildAllPipelinesAutopilotPrompt', () => {
  const allResolved = PIPELINES.map((p) => resolvePipeline(p.id)!);

  it('includes all pipeline names', () => {
    const prompt = buildAllPipelinesAutopilotPrompt(allResolved, { context: '测试' });
    for (const p of PIPELINES) {
      expect(prompt).toContain(p.name);
    }
  });

  it('includes pipeline count header', () => {
    const prompt = buildAllPipelinesAutopilotPrompt(allResolved, { context: '测试' });
    expect(prompt).toContain(`${PIPELINES.length}`);
    expect(prompt).toContain('全部工作流');
  });

  it('separates pipelines with dividers', () => {
    const prompt = buildAllPipelinesAutopilotPrompt(allResolved, { context: '测试' });
    expect(prompt).toContain('═'.repeat(60));
  });

  it('includes context in all sections', () => {
    const context = '我的任务背景';
    const prompt = buildAllPipelinesAutopilotPrompt(allResolved, { context });
    expect(prompt).toContain(context);
  });
});
