import type { SkillDefinition } from './types';

export const apiDesignSkill: SkillDefinition = {
  id: 'api-design',
  name: '接口设计',
  nameEn: 'api_design',
  order: 11,
  description: '基于业务需求设计清晰、可演进的 RESTful / GraphQL 接口规范，输出接口文档',
  descriptionEn: 'Design RESTful or GraphQL APIs with clear contracts, versioning strategy, and documentation',
  detailDescription: `根据业务需求和系统边界，设计语义清晰、可版本演进的 API 接口，
覆盖路径设计、请求/响应体、状态码、认证鉴权、错误处理和分页策略，
最终输出标准化接口规范文档（OpenAPI 3.0 风格）。`,
  triggers: [
    '接口设计',
    'API 设计',
    'api design',
    '设计接口',
    '接口规范',
    'RESTful 设计',
    'GraphQL 设计',
    '设计 REST API',
    '设计 API',
    '@ethan api',
    '@ethan 接口',
    '/接口设计',
  ],
  steps: [
    {
      title: '1. 明确业务边界与资源模型',
      content: `- 梳理本次需要暴露的**核心业务实体**（资源）
- 确定资源间的关联关系：一对一 / 一对多 / 多对多
- 识别操作类型：CRUD、操作型动作（如 /activate、/cancel）
- 确认调用方（Web / App / 第三方 / 内部服务）
- 确认认证方式：JWT / OAuth2 / API Key / Session`,
    },
    {
      title: '2. 设计 URL 路径与 HTTP 方法',
      content: `遵循 REST 语义设计路径：

**命名规范**
- 使用复数名词表示集合：\`/users\`、\`/orders\`
- 资源嵌套不超过 2 层：\`/users/{id}/orders\`
- 动作使用子资源表达：\`POST /orders/{id}/cancel\`
- 使用小写 kebab-case：\`/user-profiles\`

**HTTP 方法映射**
| 方法 | 场景 | 幂等性 |
|------|------|--------|
| GET | 查询（单个/列表） | ✅ |
| POST | 创建 / 触发动作 | ❌ |
| PUT | 全量更新 | ✅ |
| PATCH | 局部更新 | ✅ |
| DELETE | 删除 | ✅ |

**版本控制**
- URL 版本：\`/api/v1/users\`（推荐，可见性高）
- Header 版本：\`Accept: application/vnd.api+json;version=1\``,
    },
    {
      title: '3. 设计请求与响应体',
      content: `**请求体规范**
- Content-Type 统一 \`application/json\`
- 字段使用 camelCase（Web 侧）或 snake_case（按团队规范统一）
- 必填字段明确标注，给出示例值
- 枚举值给出完整列表和含义

**统一响应体格式**
\`\`\`json
{
  "code": 0,           // 0=成功，非0=错误码
  "message": "ok",     // 描述信息
  "data": { ... },     // 业务数据（成功时）
  "requestId": "uuid"  // 链路追踪 ID
}
\`\`\`

**分页响应**
\`\`\`json
{
  "code": 0,
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
\`\`\`

**HTTP 状态码使用**
- 200 OK / 201 Created / 204 No Content
- 400 Bad Request（参数错误）/ 401 Unauthorized / 403 Forbidden
- 404 Not Found / 409 Conflict / 422 Unprocessable Entity
- 500 Internal Server Error（不暴露内部细节）`,
    },
    {
      title: '4. 设计错误码体系',
      content: `建立业务错误码规范，避免所有错误都返回 500：

**错误码设计**
\`\`\`
模块前缀 + 序号：
1001xx — 用户模块
1002xx — 订单模块
1003xx — 支付模块
\`\`\`

**示例**
\`\`\`json
{
  "code": 100101,
  "message": "用户不存在",
  "data": null,
  "requestId": "abc-123"
}
\`\`\`

- 错误信息面向**开发者**（不直接展示给终端用户）
- 敏感错误（如数据库异常）统一返回 \`"系统繁忙，请稍后重试"\`
- 提供错误码文档（维护在 API 文档中）`,
    },
    {
      title: '5. 安全与性能设计',
      content: `**安全**
- 所有修改类操作（POST/PUT/PATCH/DELETE）必须鉴权
- 列表接口加入数据权限隔离（用户只能看自己的数据）
- 文件上传接口限制文件类型和大小
- 敏感字段（手机号、身份证）在响应中脱敏：\`138****8888\`
- 接口加入速率限制（Rate Limiting）

**性能**
- 列表接口支持分页（禁止无限制全量返回）
- 大数据量接口提供游标分页（cursor-based）
- 支持字段过滤：\`?fields=id,name,email\`
- 耗时操作改为异步：POST 立即返回 \`taskId\`，GET 轮询状态`,
    },
    {
      title: '6. 输出接口规范文档',
      content: `按以下格式输出每个接口的文档：

\`\`\`markdown
## POST /api/v1/users — 创建用户

**描述**：注册新用户账号

**认证**：不需要

**请求体**
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| username | string | ✅ | 用户名，3-20字符，字母数字下划线 |
| email | string | ✅ | 邮箱地址 |
| password | string | ✅ | 密码，最少8位 |

**响应示例（201 Created）**
\`\`\`json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "usr_abc123",
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

**错误码**
| code | message | 场景 |
|------|---------|------|
| 100101 | 邮箱已被注册 | 邮箱重复 |
| 100102 | 用户名不合法 | 格式校验失败 |
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 接口规范文档，含路径设计、请求/响应体、错误码表、安全说明，风格参考 OpenAPI 3.0',
  examples: [
    {
      input: '设计一个用户登录接口',
      output: `## POST /api/v1/auth/login — 用户登录

**请求体**
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | ✅ | 邮箱 |
| password | string | ✅ | 密码 |

**响应（200 OK）**
\`\`\`json
{
  "code": 0,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  }
}
\`\`\`

**错误码**：100201 账号不存在 / 100202 密码错误 / 100203 账号已锁定`,
    },
  ],
  notes: [
    'URL 路径不使用动词，操作语义由 HTTP 方法表达',
    'GraphQL 场景用 Schema First 原则，先定义类型再实现 resolver',
    '接口变更优先保持向后兼容，破坏性变更必须升版本号',
    '内部服务间调用（RPC/gRPC）可不遵循 REST 规范',
  ],
  category: '执行侧',
  nextSkill: 'implementation',
};
