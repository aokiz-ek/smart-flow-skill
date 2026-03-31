import type { SkillDefinition } from './types';

export const designPatternsSkill: SkillDefinition = {
  id: 'design-patterns',
  name: '设计模式',
  nameEn: 'design_patterns',
  order: 24,
  category: '执行侧',
  description: '识别适用场景，选择合适的 GoF 设计模式，提升代码可扩展性与可维护性',
  descriptionEn: 'Identify applicable scenarios and apply GoF design patterns to improve code extensibility and maintainability',
  detailDescription: `结合具体业务场景，从创建型、结构型、行为型三大类 GoF 设计模式中选择最适合的方案，
提供 TypeScript 实现示例，并指出过度设计的风险，帮助开发者在简洁与扩展性之间找到平衡。`,
  triggers: [
    '设计模式',
    'design pattern',
    'design patterns',
    '模式',
    'GoF',
    '工厂模式',
    '单例模式',
    '观察者模式',
    '策略模式',
    '装饰器模式',
    '依赖注入',
    '代理模式',
    '@ethan 设计模式',
    '@ethan design-patterns',
  ],
  steps: [
    {
      title: '1. 三大类模式全景',
      content: `**23 种 GoF 模式分类速查**

| 类型 | 模式 | 解决的核心问题 |
|------|------|--------------|
| **创建型** | Factory Method | 子类决定创建哪种对象 |
| | Abstract Factory | 创建一族相关对象 |
| | Builder | 分步骤构建复杂对象 |
| | Singleton | 全局唯一实例 |
| | Prototype | 克隆已有对象 |
| **结构型** | Adapter | 接口转换，兼容不兼容的接口 |
| | Decorator | 动态添加行为（不继承） |
| | Facade | 简化复杂子系统的接口 |
| | Proxy | 控制对象访问（缓存/权限/懒加载）|
| | Composite | 树形结构，统一处理单个和组合 |
| **行为型** | Observer | 一对多事件通知 |
| | Strategy | 运行时切换算法 |
| | Command | 将请求封装为对象（支持撤销）|
| | Iterator | 统一遍历集合的方式 |
| | State | 状态机，行为随状态变化 |
| | Chain of Responsibility | 请求沿链传递，直到被处理 |
| | Template Method | 算法骨架固定，子类填充步骤 |

**最常用的 5 个（优先掌握）**：Strategy, Observer, Factory, Decorator, Proxy`,
    },
    {
      title: '2. 高频模式 TypeScript 实现',
      content: `**策略模式（Strategy）— 取代 if/switch 的最佳武器**

\`\`\`typescript
// 场景：支付方式可扩展
interface PaymentStrategy {
  pay(amount: number): Promise<void>;
}

class WechatPay implements PaymentStrategy {
  async pay(amount: number) { /* 微信支付逻辑 */ }
}
class AlipayStrategy implements PaymentStrategy {
  async pay(amount: number) { /* 支付宝逻辑 */ }
}

class PaymentService {
  constructor(private strategy: PaymentStrategy) {}
  async checkout(amount: number) {
    await this.strategy.pay(amount);
  }
}

// 运行时切换，新增支付方式不改原有代码
const service = new PaymentService(new WechatPay());
\`\`\`

**观察者模式（Observer / EventEmitter）**

\`\`\`typescript
// 场景：订单状态变更通知多个系统
class OrderEventEmitter extends EventEmitter {
  emitOrderCreated(order: Order) {
    this.emit('order:created', order);
  }
}

const emitter = new OrderEventEmitter();
emitter.on('order:created', sendConfirmationEmail);
emitter.on('order:created', updateInventory);
emitter.on('order:created', triggerRecommendation);
\`\`\`

**装饰器模式（Decorator）— 不改原类，添加横切关注点**

\`\`\`typescript
// 场景：为任意服务添加缓存
function withCache<T extends object>(service: T, ttlMs = 60_000): T {
  return new Proxy(service, {
    get(target, prop) {
      const original = (target as Record<string, unknown>)[prop as string];
      if (typeof original !== 'function') return original;
      const cache = new Map<string, { value: unknown; expiry: number }>();
      return async (...args: unknown[]) => {
        const key = JSON.stringify(args);
        const cached = cache.get(key);
        if (cached && Date.now() < cached.expiry) return cached.value;
        const value = await (original as Function).apply(target, args);
        cache.set(key, { value, expiry: Date.now() + ttlMs });
        return value;
      };
    },
  });
}

const cachedUserService = withCache(userService, 30_000);
\`\`\``,
    },
    {
      title: '3. 创建型模式实践',
      content: `**工厂模式（Factory）— 解耦对象创建与使用**

\`\`\`typescript
// 场景：根据配置创建不同日志处理器
interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string) { console.log(message); }
}
class FileLogger implements Logger {
  log(message: string) { fs.appendFile('app.log', message); }
}

// 工厂函数（简单场景推荐函数而非类）
function createLogger(type: 'console' | 'file'): Logger {
  if (type === 'file') return new FileLogger();
  return new ConsoleLogger();
}
\`\`\`

**建造者模式（Builder）— 处理复杂对象构造**

\`\`\`typescript
// 场景：SQL 查询构建，参数组合多变
class QueryBuilder {
  private query = { table: '', conditions: [] as string[], limit: 100 };

  from(table: string) { this.query.table = table; return this; }
  where(condition: string) { this.query.conditions.push(condition); return this; }
  limit(n: number) { this.query.limit = n; return this; }
  build() {
    const where = this.query.conditions.length
      ? \`WHERE \${this.query.conditions.join(' AND ')}\`
      : '';
    return \`SELECT * FROM \${this.query.table} \${where} LIMIT \${this.query.limit}\`;
  }
}

// 链式调用，可读性极强
const sql = new QueryBuilder()
  .from('orders')
  .where('status = "pending"')
  .where('created_at > NOW() - INTERVAL 7 DAY')
  .limit(50)
  .build();
\`\`\`

**单例注意事项**

\`\`\`typescript
// ⚠️ 单例慎用：全局状态 = 隐式耦合
// 适用：DB连接池、全局配置、Logger
// 不适用：有状态的业务逻辑

// Node.js 模块缓存天然单例
export const db = createDbPool(); // 模块级单例，足够用
\`\`\``,
    },
    {
      title: '4. 模式选型指南与反模式',
      content: `**场景 → 模式 速查表**

| 遇到这种问题 | 考虑使用 |
|------------|---------|
| if/switch 随需求不断增长 | Strategy / Command |
| 一个变化需要修改多处 | Observer / Mediator |
| 需要在运行时给对象加功能 | Decorator / Proxy |
| 创建逻辑复杂，参数多 | Factory / Builder |
| 需要统一处理树形结构 | Composite |
| 需要兼容旧接口/第三方库 | Adapter / Facade |
| 请求需要多步验证/处理 | Chain of Responsibility |
| 对象行为随状态显著变化 | State |

**反模式：过度设计的信号**

\`\`\`
❌ 为了用设计模式而用设计模式
❌ 一个功能引入 3 层抽象（不超过 2 个接口）
❌ 到处都是 Manager / Handler / Processor 命名
❌ 接口只有一个实现类（YAGNI 原则）

✅ 正确姿势：先写简单代码，当变化来临时再重构引入模式
\`\`\`

**SOLID 原则与模式的关系**

| 原则 | 对应常用模式 |
|------|------------|
| S 单一职责 | Facade, Extract Class |
| O 开闭原则 | Strategy, Decorator |
| L 里氏替换 | Template Method |
| I 接口隔离 | Adapter |
| D 依赖倒置 | Factory, DI Container |

**输出清单**
- [ ] 识别到的模式应用场景（带代码位置）
- [ ] 选型理由（为什么选这个模式而不是另一个）
- [ ] 实现示例（TypeScript，保持 < 50 行）
- [ ] 过度设计风险说明`,
    },
  ],
  outputFormat: 'Markdown 设计模式方案：场景分析 + 模式选型理由 + TypeScript 实现示例 + 反模式警示',
  examples: [
    {
      input: '我的代码里有大量 if-else 判断支付方式，加一种支付方式就要改很多地方，怎么优化？',
      output: `## 设计模式建议：策略模式（Strategy Pattern）

**问题诊断**：发散式修改 + if/switch 蔓延，是 Open/Closed 原则的典型违反。

**解决方案**：Strategy 模式
1. 提炼 \`PaymentStrategy\` 接口（\`pay(amount): Promise<void>\`）
2. 每种支付方式实现为独立 class
3. \`PaymentService\` 通过构造注入策略
4. 新增支付方式只需新增 class，**不改任何已有代码**

**迁移步骤**（保证现有测试不破）
1. 先写策略接口 + 一个实现，并行运行
2. 逐步将 if/else 分支迁移到对应策略类
3. 最后删除原 if/else`,
    },
  ],
  notes: [
    '设计模式是工具，不是目标——代码能跑、能改才是目标',
    'TypeScript 的类型系统让很多模式更安全，善用 interface + generic',
    '函数式替代方案通常比类更简洁：Strategy → 高阶函数，Observer → EventEmitter',
    '重构引入模式时，必须有测试覆盖，见 refactoring Skill',
  ],
};
