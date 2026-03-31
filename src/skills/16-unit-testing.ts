import type { SkillDefinition } from './types';

export const unitTestingSkill: SkillDefinition = {
  id: 'unit-testing',
  name: '单元测试',
  nameEn: 'unit_testing',
  order: 16,
  category: '质量侧',
  description: '运用 AAA 模式和 TDD 工作流编写高质量单元测试，建立覆盖率目标和 Mock 策略',
  descriptionEn: 'Write high-quality unit tests using AAA pattern, TDD workflow, mocking strategies, and coverage goals',
  detailDescription: `系统指导单元测试的设计与实现，涵盖 AAA（Arrange-Act-Assert）模式、TDD 红绿重构循环、
Mock/Stub/Spy 策略选择、覆盖率目标制定和测试命名规范，帮助团队建立可维护、有效的测试体系。`,
  triggers: [
    '单元测试',
    'unit test',
    '写测试',
    'write tests',
    'TDD',
    '测试设计',
    'test design',
    'mock 策略',
    'mocking',
    '测试覆盖率',
    'coverage',
    '@ethan test',
    '@ethan unit-testing',
  ],
  steps: [
    {
      title: '1. 明确测试目标与范围',
      content: `在编写测试前，先明确测什么：

**测试金字塔**
\`\`\`
        ┌───────────┐
        │  E2E 测试  │  (少量，慢，高置信)
       ┌┴───────────┴┐
       │  集成测试    │  (适量，中速)
      ┌┴─────────────┴┐
      │  单元测试      │  (大量，快，低成本)
      └───────────────┘
\`\`\`

**单元测试应该覆盖**
- ✅ 纯函数的各种输入输出（含边界）
- ✅ 类/模块的公共方法逻辑
- ✅ 条件分支（if/switch/三元）
- ✅ 错误处理路径（throw/catch）
- ✅ 异步操作（Promise/async-await）

**不应该单元测试**
- ❌ 简单的 getter/setter（无逻辑）
- ❌ 第三方库内部实现
- ❌ 框架本身（如 React 渲染机制）
- ❌ 私有方法（通过公共方法间接测试）`,
    },
    {
      title: '2. AAA 模式编写测试用例',
      content: `每个测试用例遵循 **Arrange → Act → Assert** 三段式结构：

**基础示例（JavaScript/TypeScript with Vitest/Jest）**
\`\`\`typescript
describe('calculateDiscount', () => {
  it('should apply 20% discount for premium users', () => {
    // Arrange（准备：设置测试数据和依赖）
    const user = { type: 'premium', cart: [{ price: 100 }, { price: 50 }] };
    const expectedTotal = 120;  // 150 * 0.8

    // Act（执行：调用被测函数）
    const result = calculateDiscount(user);

    // Assert（断言：验证结果）
    expect(result.total).toBe(expectedTotal);
    expect(result.discountRate).toBe(0.2);
  });
});
\`\`\`

**测试命名规范（Given-When-Then）**
\`\`\`typescript
// 格式: should <expected behavior> when <condition>
it('should return null when user is not found')
it('should throw AuthError when token is expired')
it('should apply 20% discount when user has premium status')

// 或使用 Given-When-Then 风格
it('given empty cart, when checkout, then throws EmptyCartError')
\`\`\`

**边界条件测试清单**
\`\`\`typescript
describe('parseAge', () => {
  // 正常值
  it('should parse valid age 25')
  // 边界值
  it('should accept minimum age 0')
  it('should accept maximum age 150')
  // 非法值
  it('should throw when age is negative')
  it('should throw when age exceeds 150')
  // 类型边界
  it('should throw when age is not a number')
  it('should throw when age is null or undefined')
  it('should handle decimal by flooring to integer')
});
\`\`\``,
    },
    {
      title: '3. TDD 工作流（红-绿-重构）',
      content: `**TDD 循环步骤**

\`\`\`
🔴 Red   → 写一个失败的测试（先设计接口）
🟢 Green → 写最少代码让测试通过（不过度设计）
🔵 Refactor → 在测试保护下重构代码
\`\`\`

**实践示例：用 TDD 实现邮箱验证**

\`\`\`typescript
// Step 1 🔴 先写测试（此时 validateEmail 还不存在）
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  it('should return false for missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });
  it('should return false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

// Step 2 🟢 写最简实现让测试通过
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Step 3 🔵 重构：提取正则为常量，添加类型注释
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email);
}
\`\`\`

**TDD 适用场景**
- 明确需求的业务逻辑函数
- 工具库/SDK 开发
- Bug 修复（先写复现测试再修复）

**不强制 TDD 的场景**
- 探索性开发阶段
- UI 组件（先实现再补测试）`,
    },
    {
      title: '4. Mock / Stub / Spy 策略',
      content: `**三种测试替身的区别**

| 类型 | 用途 | 验证方式 |
|------|------|---------|
| **Stub** | 替换外部依赖，控制返回值 | 只验证输出 |
| **Mock** | 验证函数是否被正确调用 | 验证调用行为 |
| **Spy** | 监听真实函数的调用情况 | 包装真实实现 |

**Vitest/Jest 实践**
\`\`\`typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Stub: 控制外部 API 返回值
vi.mock('../api/user', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
}));

// Mock: 验证函数被调用
it('should call sendEmail when user registers', async () => {
  const sendEmail = vi.fn();
  await registerUser({ email: 'test@test.com' }, { sendEmail });
  expect(sendEmail).toHaveBeenCalledOnce();
  expect(sendEmail).toHaveBeenCalledWith('test@test.com', expect.objectContaining({ subject: 'Welcome' }));
});

// Spy: 包装真实函数监听
it('should log error when fetch fails', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fetchUser).mockRejectedValue(new Error('Network Error'));
  await loadUserProfile(1);
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
  consoleSpy.mockRestore();
});
\`\`\`

**Mock 黄金法则**
- 只 Mock 跨边界的依赖（网络、数据库、文件系统、时间）
- 不要 Mock 被测单元的内部实现
- 每次测试后还原 Mock（使用 \`beforeEach(() => vi.clearAllMocks())\`）`,
    },
    {
      title: '5. 覆盖率目标与质量保障',
      content: `**覆盖率类型与目标**

| 覆盖率类型 | 说明 | 建议目标 |
|----------|------|---------|
| 语句覆盖（Statements） | 执行的语句比例 | ≥ 80% |
| 分支覆盖（Branches） | if/else 分支比例 | ≥ 75% |
| 函数覆盖（Functions） | 调用的函数比例 | ≥ 80% |
| 行覆盖（Lines） | 执行的代码行比例 | ≥ 80% |

**Vitest 覆盖率配置**
\`\`\`typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',  // 或 'istanbul'
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'node_modules/',
        'src/types/',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
});
\`\`\`

**覆盖率反模式（要避免）**
\`\`\`typescript
// ❌ 为了覆盖率写无意义断言
it('does something', () => {
  expect(doSomething()).toBeDefined();  // 没有验证具体行为
});

// ✅ 验证真实业务逻辑
it('should return correct discounted price', () => {
  expect(calculatePrice(100, 0.1)).toBe(90);
});
\`\`\`

**CI 集成**
\`\`\`yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm run test -- --coverage

- name: Comment coverage on PR
  uses: MishaKav/jest-coverage-comment@main
  with:
    coverage-summary-path: ./coverage/coverage-summary.json
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 测试方案文档，含测试用例设计（AAA 格式）、Mock 策略说明、覆盖率目标和 CI 配置示例',
  examples: [
    {
      input: '帮我为这个 calculateTax 函数写单元测试',
      output: `## 单元测试方案：calculateTax

\`\`\`typescript
describe('calculateTax', () => {
  describe('standard rate (20%)', () => {
    it('should apply 20% tax to positive amount', () => {
      expect(calculateTax(100, 'standard')).toBe(20);
    });
    it('should return 0 tax for zero amount', () => {
      expect(calculateTax(0, 'standard')).toBe(0);
    });
  });

  describe('error cases', () => {
    it('should throw when amount is negative', () => {
      expect(() => calculateTax(-1, 'standard')).toThrow('Amount must be positive');
    });
    it('should throw for unknown tax category', () => {
      expect(() => calculateTax(100, 'unknown' as any)).toThrow('Unknown tax category');
    });
  });
});
\`\`\``,
    },
  ],
  notes: [
    '测试应该是自文档化的，好的测试名称比注释更有价值',
    '避免测试实现细节，测试行为而非内部结构，有助于重构时测试不频繁失败',
    '不要追求 100% 覆盖率，关注核心业务逻辑的质量覆盖',
    '测试代码同样需要维护，避免过度复杂的测试辅助函数',
  ],
  nextSkill: 'system-design',
};
