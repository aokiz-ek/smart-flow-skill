import type { SkillDefinition } from './types';

export const refactoringSkill: SkillDefinition = {
  id: 'refactoring',
  name: '代码重构',
  nameEn: 'refactoring',
  order: 22,
  category: '质量侧',
  description: '系统化识别代码坏味道，运用重构手法安全改善代码结构，不改变外部行为',
  descriptionEn: 'Systematically identify code smells and apply refactoring techniques to improve structure without changing behavior',
  detailDescription: `按照 Martin Fowler 重构方法论，识别 Bad Smells（重复代码、过长函数、散弹式修改等），
运用提炼函数/类、移动特性、简化条件逻辑等重构手法，配合测试保驾护航，逐步改善代码质量。`,
  triggers: [
    '代码重构',
    'refactoring',
    'refactor',
    '重构',
    '坏味道',
    'bad smell',
    '技术债',
    'technical debt',
    '代码质量改善',
    '@ethan refactor',
    '@ethan 重构',
  ],
  steps: [
    {
      title: '1. 识别代码坏味道（Bad Smells）',
      content: `重构前先诊断，明确改善目标：

**最常见的 12 种坏味道**

| 坏味道 | 症状 | 危害 |
|--------|------|------|
| **重复代码** | 相同逻辑出现 ≥2 处 | 修改需同步多处，极易遗漏 |
| **过长函数** | 函数 > 20 行 | 难以理解、测试、复用 |
| **过大的类** | 类承担过多职责 | 违反 SRP，耦合严重 |
| **过长参数列表** | 参数 > 4 个 | 调用复杂，难以记忆 |
| **发散式变化** | 一个类因不同原因被修改 | 违反 SRP |
| **散弹式修改** | 一个变化需改多处 | 高耦合，遗漏风险高 |
| **依恋情结** | 方法频繁访问其他类数据 | 逻辑放错了地方 |
| **数据泥团** | 多处总是成组出现的数据 | 缺少封装 |
| **基本类型偏执** | 用原始类型代替小对象 | 缺少领域建模 |
| **注释过多** | 用注释弥补代码的不清晰 | 注释是坏味道的遮羞布 |
| **过深嵌套** | 条件/循环嵌套 > 3 层 | 圈复杂度高，难以追踪 |
| **僵尸代码** | 死代码、被注释的代码块 | 干扰阅读，增加维护负担 |

\`\`\`bash
# 快速扫描工具
npx eslint src --rule '{"complexity": ["warn", 10]}'  # 圈复杂度
npx jscpd src --threshold 5                           # 重复代码检测
ethan scan --todo                                      # TODO/FIXME 清单
\`\`\``,
    },
    {
      title: '2. 核心重构手法',
      content: `**提炼函数（Extract Function）** — 最常用

\`\`\`typescript
// Before: 过长函数，注释掩盖意图
function processOrder(order: Order) {
  // 计算折扣
  let discount = 0;
  if (order.user.isPremium) discount = 0.1;
  if (order.total > 1000) discount += 0.05;
  const finalPrice = order.total * (1 - discount);

  // 发送确认邮件
  const subject = \`订单 \${order.id} 确认\`;
  sendEmail(order.user.email, subject, finalPrice);
}

// After: 每个函数做一件事
function calculateDiscount(order: Order): number {
  let discount = 0;
  if (order.user.isPremium) discount = 0.1;
  if (order.total > 1000) discount += 0.05;
  return discount;
}

function sendOrderConfirmation(order: Order, finalPrice: number): void {
  const subject = \`订单 \${order.id} 确认\`;
  sendEmail(order.user.email, subject, finalPrice);
}

function processOrder(order: Order) {
  const discount = calculateDiscount(order);
  const finalPrice = order.total * (1 - discount);
  sendOrderConfirmation(order, finalPrice);
}
\`\`\`

**以多态取代条件（Replace Conditional with Polymorphism）**

\`\`\`typescript
// Before: switch 散弹式修改
function getShippingCost(order: Order): number {
  switch (order.type) {
    case 'standard': return order.weight * 10;
    case 'express': return order.weight * 20 + 50;
    case 'overnight': return order.weight * 30 + 100;
  }
}

// After: 策略模式/多态
abstract class ShippingStrategy {
  abstract calculate(order: Order): number;
}
class StandardShipping extends ShippingStrategy {
  calculate(order: Order) { return order.weight * 10; }
}
class ExpressShipping extends ShippingStrategy {
  calculate(order: Order) { return order.weight * 20 + 50; }
}
\`\`\`

**引入参数对象（Introduce Parameter Object）**

\`\`\`typescript
// Before: 过长参数列表
function createReport(startDate: Date, endDate: Date, userId: string, format: string) {}

// After: 封装为值对象
interface ReportParams { dateRange: DateRange; userId: string; format: string; }
function createReport(params: ReportParams) {}
\`\`\`

**其他常用手法速查**

| 手法 | 适用场景 |
|------|---------|
| 提炼类（Extract Class） | 一个类承担过多职责 |
| 移动函数（Move Function） | 方法与数据不在一处 |
| 内联函数（Inline Function） | 函数体比名字更清晰 |
| 分解条件（Decompose Conditional） | 复杂 if-else 逻辑 |
| 卫语句（Guard Clauses） | 深层嵌套 → 提前返回 |
| 以查询取代临时变量 | 中间临时变量过多 |`,
    },
    {
      title: '3. 重构安全网：测试先行',
      content: `**重构铁律：没有测试，不要重构**

\`\`\`bash
# Step 1: 确保现有测试覆盖率充足
npm run test:coverage
# 目标：被重构的模块覆盖率 > 80%

# Step 2: 若无测试，先补特征测试（Characterization Test）
# 不是测试"应该如何"，而是记录"当前如何"
it('characterization: processOrder returns expected price', () => {
  const result = processOrder(mockOrder);
  expect(result).toMatchSnapshot(); // 先快照，重构后验证不变
});

# Step 3: 小步前进 — 每次重构后立即运行测试
npm test -- --watch
\`\`\`

**重构工作流**

\`\`\`
识别目标 → 写/补测试 → 最小重构 → 运行测试 → 提交
     ↑____________________________|
           循环，每次改动 < 30min
\`\`\`

**IDE 辅助重构（减少手工失误）**

| 操作 | VS Code / WebStorm |
|------|-------------------|
| 提炼函数 | Ctrl+Shift+R → Extract Method |
| 重命名 | F2 → 自动更新所有引用 |
| 移动文件 | 拖拽 → 自动更新 import |
| 提炼变量 | Ctrl+Shift+R → Extract Variable |`,
    },
    {
      title: '4. 重构策略与输出',
      content: `**Boy Scout Rule（童子军规则）**
> 让代码比你来时更干净一点，每次 PR 顺手重构接触到的代码。

**大规模重构策略：Strangler Fig Pattern（绞杀榕模式）**

\`\`\`
旧系统 ──[façade]──→ 新模块（逐步替换）
         |
         └──→ 旧模块（逐步废弃）
\`\`\`

1. 在旧代码外包一层 Façade/Adapter
2. 新功能全部写在新结构中
3. 旧调用方逐步迁移到新结构
4. 旧代码最终归零删除

**何时停止重构**

| 信号 | 建议 |
|------|------|
| 测试全绿，代码可读性提升 | 提交，结束本轮 |
| 发现需要改外部接口 | 创建新 Issue，本次不做 |
| 重构范围不断扩大 | 停止，重新评估范围 |

**重构输出清单**
- [ ] 坏味道清单（标注优先级 P1/P2/P3）
- [ ] 本次重构的 Diff 说明（what changed & why）
- [ ] 测试覆盖率前后对比
- [ ] 技术债记录到 Issue/Backlog`,
    },
  ],
  outputFormat: 'Markdown 重构报告：坏味道清单 + 重构手法说明 + 测试覆盖率变化 + 技术债 Backlog',
  examples: [
    {
      input: '这个函数有 200 行，我需要重构它',
      output: `## 重构计划 — 200 行过长函数

**识别问题**：函数超过 20 行阈值 10 倍，违反单一职责

**步骤**
1. 先写特征测试（Characterization Test），用快照记录当前行为
2. 按注释/空行识别功能段落，每段提炼为独立函数
3. 若有共享状态，考虑提炼为类
4. 每提炼一个函数后立即运行测试

**预计拆分结果**：1 个 orchestration 函数 + 5-10 个小函数，每个 < 20 行`,
    },
  ],
  notes: [
    '重构前必须有测试覆盖，否则是在盲目改动——叫重写不叫重构',
    '每次重构只做一件事，不要同时修改功能',
    '利用 IDE 的自动重构功能，减少手工失误',
    '技术债需要持续还，但不要以重构为名无限延期需求',
  ],
  nextSkill: 'observability',
};
