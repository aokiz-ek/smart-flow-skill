import type { SkillDefinition } from './types';

export const apiMockSkill: SkillDefinition = {
  id: 'api-mock',
  name: 'API Mock 服务',
  nameEn: 'api_mock',
  order: 28,
  description: '根据接口定义生成 MSW/JSON Server Mock 配置，支持动态数据与边界场景模拟',
  descriptionEn: 'Generate MSW/JSON Server mock configs from API specs, supporting dynamic data and edge case simulation',
  detailDescription: `前后端并行开发的核心痛点是接口未就绪时前端无法推进。
本 Skill 帮助团队快速搭建 Mock 服务：从 OpenAPI/Swagger 或接口描述生成 MSW handlers、
JSON Server 配置，集成 faker.js 生成真实感测试数据，并模拟网络错误、超时、边界场景，
让前端开发完全不依赖后端进度。`,
  triggers: [
    'api mock',
    'mock service',
    'mock 服务',
    '接口 mock',
    'msw',
    'json server',
    'mock 数据',
    '接口模拟',
    '@ethan api-mock',
    '/api-mock',
  ],
  steps: [
    {
      title: '1. 接口分析与 Mock 范围确定',
      content: `分析需要 Mock 的接口，建立清单：

**接口信息收集**
- OpenAPI/Swagger 文档路径（如 \`api/swagger.json\`）
- 手工接口描述（方法、路径、请求/响应结构）
- 需要模拟的特殊场景（401/403/500/超时/慢响应）

**Mock 范围分类**
\`\`\`
📋 待 Mock 接口清单
├── 认证接口
│   ├── POST /api/auth/login        ← 成功 / 密码错误 / 账号锁定
│   └── POST /api/auth/refresh      ← 成功 / token 过期
├── 用户接口
│   ├── GET  /api/users             ← 列表 / 空列表 / 分页
│   └── GET  /api/users/:id         ← 成功 / 404
└── 业务接口
    ├── POST /api/orders            ← 成功 / 库存不足 / 支付失败
    └── GET  /api/orders?status=... ← 各状态过滤
\`\`\`

**输出**：接口 Mock 清单（含边界场景枚举）`,
    },
    {
      title: '2. Mock 方案选型',
      content: `根据项目特点选择最合适的 Mock 方案：

**选型矩阵**

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **MSW（推荐）** | React/Vue 前端项目 | 拦截真实网络请求，零侵入，支持 Jest/Vitest | 需要 Service Worker |
| **JSON Server** | REST API 快速原型 | 零代码，自动 CRUD | 功能有限，不支持复杂逻辑 |
| **Mirage.js** | Ember/复杂 SPA | 内置数据库，关系模型支持 | 包较大，配置复杂 |
| **Nock** | Node.js 单元测试 | 精确控制 HTTP 请求 | 仅限 Node 环境 |

**推荐组合**：
- 开发阶段：**MSW**（浏览器端拦截）
- 单元测试：**MSW + @mswjs/data**（内存数据库）
- 快速原型：**JSON Server**（5分钟启动）

**输出**：选型决策 + 安装命令`,
    },
    {
      title: '3. MSW handlers 生成',
      content: `生成 MSW（Mock Service Worker）拦截处理器：

**安装**
\`\`\`bash
npm install msw --save-dev
npx msw init public/ --save
\`\`\`

**handlers.ts 模板**
\`\`\`typescript
// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import { faker } from '@faker-js/faker';

export const handlers = [
  // ─── 认证接口 ──────────────────────────────────────
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json() as any;

    // 模拟特殊场景
    if (password === 'wrong') {
      return HttpResponse.json(
        { code: 401, message: '密码错误' },
        { status: 401 }
      );
    }
    if (email === 'locked@test.com') {
      return HttpResponse.json(
        { code: 423, message: '账号已锁定，请联系管理员' },
        { status: 423 }
      );
    }

    // 正常响应
    return HttpResponse.json({
      token: faker.string.uuid(),
      user: { id: faker.string.uuid(), email, name: faker.person.fullName() },
    });
  }),

  // ─── 用户列表（分页）──────────────────────────────
  http.get('/api/users', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10);

    const total = 87;
    const items = Array.from({ length: Math.min(pageSize, total - (page - 1) * pageSize) }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      createdAt: faker.date.past().toISOString(),
    }));

    return HttpResponse.json({ items, total, page, pageSize });
  }),

  // ─── 慢响应模拟 ────────────────────────────────────
  http.get('/api/slow-endpoint', async () => {
    await delay(3000); // 模拟 3 秒延迟
    return HttpResponse.json({ data: 'slow response' });
  }),

  // ─── 网络错误模拟 ──────────────────────────────────
  http.get('/api/network-error', () => {
    return HttpResponse.error(); // 模拟网络断开
  }),
];
\`\`\`

**browser.ts（浏览器初始化）**
\`\`\`typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);
\`\`\`

**server.ts（Node.js/测试环境）**
\`\`\`typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
\`\`\`

**输出**：完整 handlers.ts + browser.ts + server.ts`,
    },
    {
      title: '4. JSON Server 配置',
      content: `生成 JSON Server 快速 REST Mock 配置：

**安装与启动**
\`\`\`bash
npm install json-server --save-dev
# 启动：json-server --watch db.json --port 3001 --routes routes.json
\`\`\`

**db.json（数据库）**
\`\`\`json
{
  "users": [
    { "id": "1", "name": "张三", "email": "zhang@test.com", "role": "admin" },
    { "id": "2", "name": "李四", "email": "li@test.com", "role": "user" }
  ],
  "orders": [
    { "id": "101", "userId": "1", "status": "pending", "amount": 299.00, "createdAt": "2024-01-15" },
    { "id": "102", "userId": "2", "status": "completed", "amount": 599.00, "createdAt": "2024-01-16" }
  ],
  "products": [
    { "id": "P001", "name": "商品A", "price": 99.00, "stock": 100 }
  ]
}
\`\`\`

**routes.json（路由重写）**
\`\`\`json
{
  "/api/*": "/$1",
  "/api/v1/*": "/$1",
  "/api/users/:id/orders": "/orders?userId=:id"
}
\`\`\`

**package.json 脚本**
\`\`\`json
{
  "scripts": {
    "mock": "json-server --watch src/mocks/db.json --port 3001 --routes src/mocks/routes.json",
    "dev:mock": "concurrently \\"npm run mock\\" \\"npm run dev\\""
  }
}
\`\`\`

**输出**：db.json + routes.json + npm 脚本`,
    },
    {
      title: '5. 动态数据与边界场景策略',
      content: `用 faker.js 生成真实感数据，覆盖各类边界场景：

**faker.js 常用生成器速查**
\`\`\`typescript
import { faker } from '@faker-js/faker/locale/zh_CN'; // 中文数据

// 个人信息
faker.person.fullName()          // 王小明
faker.internet.email()           // user@example.com
faker.phone.number()             // 138-1234-5678
faker.date.birthdate()           // 生日

// 地址
faker.location.city()            // 上海
faker.location.streetAddress()   // 延安路 123 号

// 业务数据
faker.string.uuid()              // UUID
faker.number.int({ min:1, max:100 })  // 随机整数
faker.helpers.arrayElement(['pending', 'active', 'closed'])  // 随机枚举
faker.helpers.multiple(() => faker.person.fullName(), { count: 10 })  // 批量生成
\`\`\`

**边界场景 Checklist**
- [ ] 空列表（返回 \`{ items: [], total: 0 }\`）
- [ ] 单条数据（边界分页）
- [ ] 超长字符串（名称 > 100 字符）
- [ ] 特殊字符（\`<script>\`、SQL 注入字符串）
- [ ] 极大数字（金额 = 999999999.99）
- [ ] 时区边界（UTC+8 vs UTC）
- [ ] 并发响应竞态（两个请求同时返回）
- [ ] 401 token 过期 → 自动刷新
- [ ] 503 服务不可用 → 降级 UI

**测试集成（Vitest）**
\`\`\`typescript
// setupTests.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers()); // 每个测试后重置
afterAll(() => server.close());
\`\`\`

**输出**：faker 数据工厂函数 + 边界场景 handlers + 测试集成配置`,
    },
  ],
  outputFormat: 'Mock 方案选型报告 + MSW handlers.ts + JSON Server db.json/routes.json + faker 数据工厂 + 边界场景 Checklist + 测试集成配置',
  examples: [],
  notes: [
    'MSW 是目前最推荐的前端 Mock 方案，可在浏览器和 Node.js 两种环境无缝切换',
    'Mock 数据应尽量真实（使用 faker.js），避免 "test"/"demo" 等无意义数据干扰开发体验',
    '边界场景的 Mock 与正常流程同等重要，建议用命名 handler（override）覆写特定测试场景',
    '生产环境应通过环境变量完全关闭 Mock，避免意外拦截真实请求',
  ],
  category: '执行侧',
  nextSkill: 'unit-testing',
};
