import type { SkillDefinition } from './types';

export const specProposalSkill: SkillDefinition = {
  id: 'spec-proposal',
  name: 'Spec Proposal',
  nameEn: 'spec_proposal',
  order: 25,
  description: '遵循 OpenSpec 规范，在编码前生成完整变更提案包（proposal + design + tasks + spec delta）',
  descriptionEn: 'Generate a complete OpenSpec change proposal package before coding: proposal, design, tasks and spec deltas',
  detailDescription: `遵循 OpenSpec 规范，在编写任何代码之前先生成完整的变更提案文档包。
包含变更描述（proposal.md）、技术方案（design.md）、分阶段任务（tasks.md）
和需求变更 delta（openspec/changes/[id]/specs/）。
让团队在实施前对齐意图和范围，"Review intent, not just code"。`,
  triggers: [
    'spec proposal',
    'openspec proposal',
    '生成提案',
    '变更提案',
    'spec 提案',
    '写 proposal',
    '@ethan spec proposal',
    '/spec-proposal',
  ],
  steps: [
    {
      title: '1. 扫描现有 Spec 上下文',
      content: `查阅 openspec/specs/ 目录，了解已有规范：

- 列出所有 capability 目录及其 spec.md 摘要
- 识别本次变更涉及的 capability（可能跨多个）
- 了解现有需求（Requirements）和场景（Scenarios）边界

**如无 openspec 目录**：询问用户需要创建哪些 capability 的 spec，用 \`ethan spec init [capability]\` 初始化。

**输出**：涉及的 spec 文件列表 + 关键现有需求摘要`,
    },
    {
      title: '2. 生成 proposal.md（变更提案）',
      content: `生成 openspec/changes/[change-id]/proposal.md：

\`\`\`markdown
# Change Proposal: [变更标题]

> Change ID: [yyyymmdd-xxxx]

## 变更描述
[1-3 句话说明这个变更要做什么]

## 动机与背景
[为什么需要这个变更，解决什么业务问题]

## 影响范围
- 涉及的 Capability：[列表]
- 影响的用户角色：[列表]
- 影响的现有功能：[列表]

## 非功能性考量
- 性能影响：[说明或无]
- 安全考量：[说明或无]
- 向后兼容性：[说明]
\`\`\``,
    },
    {
      title: '3. 生成 design.md（技术方案）',
      content: `生成 openspec/changes/[change-id]/design.md：

\`\`\`markdown
# Technical Design: [变更标题]

## 架构决策
[关键架构选择及原因，如技术选型、模式选择]

## 接口变更
[新增/修改的 API 端点、组件 Props、函数签名]

## 数据模型变更
[新增/修改的数据库表、数据结构]

## 实现方案
[核心实现思路，关键算法或流程]

## 风险与缓解措施
[技术风险点 → 对应缓解策略]
\`\`\``,
    },
    {
      title: '4. 生成 tasks.md（实现任务）',
      content: `生成 openspec/changes/[change-id]/tasks.md，按阶段拆分原子任务：

\`\`\`markdown
# Implementation Tasks: [变更标题]

## Phase 1: 基础准备
- [ ] Task 1.1: [任务描述] | 估算：S/M/L

## Phase 2: 核心实现
- [ ] Task 2.1: [任务描述] | 估算：S/M/L

## Phase 3: 测试与验收
- [ ] Task 3.1: 编写单元测试，覆盖所有场景 AC
- [ ] Task 3.2: Spec Review — 验证代码与 spec delta 对齐

## 总估算
S: [n] | M: [n] | L: [n]
\`\`\`

每个任务应足够原子，可独立完成和验证。`,
    },
    {
      title: '5. 生成 Spec Delta（需求变更）',
      content: `为每个涉及的 capability 生成需求变更文件（openspec/changes/[id]/specs/[capability].md）：

\`\`\`markdown
# Spec Delta: [capability]

> 变更描述：[本次变更对此 capability 的影响]

## 新增需求

### REQ-XXX: [新需求名称]
[需求描述]

## 修改需求

**变更前：**
[原需求内容]

**变更后：**
[新需求内容]

## 新增场景

GIVEN [前置条件]
WHEN [用户操作]
THEN [预期结果]
\`\`\`

**原则**：Spec delta 只记录"变化"，不重复现有 spec 的未变更内容。`,
    },
  ],
  outputFormat:
    'OpenSpec 变更提案包（保存到 openspec/changes/[change-id]/）：\n' +
    '- proposal.md（变更提案）\n' +
    '- design.md（技术方案）\n' +
    '- tasks.md（分阶段任务）\n' +
    '- specs/[capability].md（spec delta，每个涉及的 capability 一个文件）',
  examples: [],
  notes: [
    '提案应在编写任何代码之前生成，让团队先对变更意图达成共识',
    'Spec delta 只记录"变化"，不重复现有 spec 内容',
    'tasks.md 的每个任务应足够原子，可独立完成和验证',
    '如项目尚无 openspec 目录，先运行 ethan spec init [capability] 初始化',
  ],
  category: '需求侧',
  nextSkill: 'solution-design',
};
