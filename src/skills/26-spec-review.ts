import type { SkillDefinition } from './types';

export const specReviewSkill: SkillDefinition = {
  id: 'spec-review',
  name: 'Spec Review（意图审查）',
  nameEn: 'spec_review',
  order: 26,
  description: '基于 OpenSpec，对比 spec delta 与代码实现，执行意图级 Review（而非逐行代码审查）',
  descriptionEn: 'Intent-based review: compare spec deltas against code changes to verify implementation aligns with requirements',
  detailDescription: `不同于传统 Code Review 关注代码细节，Spec Review 从需求意图出发：
对照 openspec/changes/ 中的 spec delta，检查代码实现是否准确反映了需求变更的意图。
发现遗漏需求、超范围实现、与 spec 不一致的实现，让 PR Review 回归业务价值本身。
"Review intent, not just code"。`,
  triggers: [
    'spec review',
    'intent review',
    '意图审查',
    'openspec review',
    'spec 审查',
    '需求对齐检查',
    '@ethan spec review',
    '/spec-review',
  ],
  steps: [
    {
      title: '1. 加载 Spec 上下文',
      content: `读取本次变更相关的 OpenSpec 文档：

1. 定位 openspec/changes/[change-id]/ 目录（取最新的或由用户指定）
2. 读取 proposal.md（了解变更目标和意图）
3. 读取 specs/[capability].md（逐个 spec delta）
4. 读取代码 diff（git diff HEAD 或 PR diff）

**目标**：建立"期望变更"（spec delta）和"实际变更"（代码）的对照关系。

如无 change proposal，说明本次改动未经过 spec 规范流程，建议先运行 \`ethan spec proposal\`。`,
    },
    {
      title: '2. 意图对齐检查',
      content: `逐条检查每个 spec delta 条目是否在代码中得到正确实现：

**对齐矩阵模板**

| Spec 需求/场景 | 对应代码位置 | 对齐状态 | 说明 |
|--------------|------------|---------|------|
| REQ-XXX: [需求名] | [文件:行号] | ✅ | 完全实现 |
| Scenario: [场景名] | [文件:行号] | ⚠️ | 边界条件缺失 |
| REQ-YYY: [需求名] | — | ❌ | 未找到实现 |
| [代码功能] | [文件:行号] | 🔄 | 超出 spec 范围 |

**状态说明**
- ✅ 完全实现：代码与 spec 意图一致，GIVEN/WHEN/THEN 均覆盖
- ⚠️ 部分实现：核心逻辑存在但细节缺失（如缺少异常处理）
- ❌ 未实现：spec 要求的功能在代码中找不到
- 🔄 超范围：代码实现了 spec 未定义的内容`,
    },
    {
      title: '3. 偏差识别与分级',
      content: `识别三类关键偏差：

**🔴 意图偏差（Critical）—— 必须修复才能合并**
代码实现与 spec 意图相反或严重不符，例如：
- 场景要求"3次失败后锁定账号"，实际实现了"无限重试"
- 权限检查逻辑与 GIVEN/WHEN/THEN 定义的场景不匹配
- 数据模型与 spec delta 中定义的结构不一致

**🟡 遗漏需求（Warning）—— 强烈建议补充**
spec 中定义的场景或需求在代码中未体现：
- 异常流程未处理（spec 中有 THEN [错误情况] 但代码未实现）
- 边界条件未覆盖（如空值、超长输入、并发）
- 非功能性需求未落实（如性能、安全要求）

**💡 超范围实现（Info）—— 确认并按需更新 spec**
代码实现了 spec 没有定义的功能：
- 可能是合理的技术实现细节（不需要更新 spec）
- 也可能是功能范围蔓延（需补充 spec delta 或回退）`,
    },
    {
      title: '4. 输出 Spec Review 报告',
      content: `生成结构化的意图审查报告：

\`\`\`markdown
# Spec Review Report

## 变更提案摘要
- Change ID: [id]
- 变更目标：[proposal.md 核心摘要]
- 涉及 Capability：[列表]

## 意图对齐矩阵
[对照表格]

## 关键发现

### 🔴 意图偏差（[n] 项）
1. **[偏差描述]**
   - Spec 要求：[spec 原文]
   - 实际实现：[代码位置] [实际行为]
   - 建议：[修复方向]

### 🟡 遗漏需求（[n] 项）
[列表]

### 💡 超范围实现（[n] 项）
[列表]

## 审查结论
- [ ] 意图完全对齐，可以合并
- [ ] 需要修复意图偏差后重新审查
- [ ] 需要更新 spec（超范围实现合理）
\`\`\``,
    },
  ],
  outputFormat:
    'Spec Review 报告：意图对齐矩阵 + 三级偏差列表（🔴意图偏差 / 🟡遗漏需求 / 💡超范围）+ 审查结论',
  examples: [],
  notes: [
    'Spec Review 不替代 Code Review，两者互补：Spec Review 审意图，Code Review 审实现质量',
    '如果没有对应的 spec delta，说明该改动未经过规范的 spec 流程，需补充',
    '超范围实现不一定是问题，但必须显式确认并按需更新 spec',
    'GIVEN/WHEN/THEN 场景是最好的对齐锚点，每个场景都应在代码中有对应的实现',
  ],
  category: '质量侧',
  nextSkill: undefined,
};
