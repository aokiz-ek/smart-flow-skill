import type { SkillDefinition } from './types';

export const codeReviewSkill: SkillDefinition = {
  id: 'code-review',
  name: '代码审查',
  nameEn: 'code_review',
  order: 8,
  description: '系统性审查代码变更，分级输出 Blocker/Major/Minor 问题，提升代码质量',
  detailDescription: `对代码变更进行系统性审查，覆盖正确性、安全性、性能、可维护性和规范性五个维度，
按 Blocker/Major/Minor 三级分类输出问题，并给出具体改进建议。`,
  triggers: [
    '代码审查',
    'code review',
    'CR',
    '帮我 review',
    '帮我看看代码',
    '审查代码',
    'review 一下',
    '代码 review',
    '/代码审查',
    '@ethan review',
  ],
  steps: [
    {
      title: '1. 理解变更意图',
      content: `- 阅读 PR 描述或变更说明，明确本次改动的**业务目标**
- 识别变更范围：新功能 / Bug 修复 / 重构 / 性能优化 / 配置调整
- 确认是否有对应的需求文档、设计文档或 Issue
- 了解测试覆盖情况（单测/集成测试）`,
    },
    {
      title: '2. 逐层审查',
      content: `按以下五个维度逐一检查：

**✅ 正确性**
- 逻辑是否正确，边界条件是否处理（null/undefined/空数组/越界）
- 并发/异步场景是否有竞态条件
- 错误处理是否完备

**🔒 安全性**
- 是否存在 SQL 注入、XSS、CSRF 等 OWASP Top 10 风险
- 敏感信息（密钥、密码）是否硬编码
- 权限校验是否完整

**⚡ 性能**
- 是否有 N+1 查询、不必要的全量加载
- 循环内是否有重复计算或 DOM 操作
- 是否缺少必要的缓存或索引

**🔧 可维护性**
- 函数/类职责是否单一
- 命名是否清晰表达意图
- 是否有重复代码（DRY 原则）
- 复杂逻辑是否有注释说明

**📏 规范性**
- 是否符合项目代码风格（命名、格式、文件结构）
- 是否有缺失的测试用例
- API 变更是否更新了文档`,
    },
    {
      title: '3. 按级别分类问题',
      content: `将发现的问题按以下三级分类：

- 🚫 **Blocker**：必须修复才能合并（功能错误、安全漏洞、数据丢失风险）
- ⚠️ **Major**：强烈建议修复（性能问题、可维护性严重不足、测试缺失）
- 💡 **Minor**：建议改进（代码风格、命名优化、注释补充）

每个问题标注：文件名 + 行号 + 问题描述 + 改进建议`,
    },
    {
      title: '4. 输出审查报告',
      content: `按以下格式输出：

\`\`\`markdown
## Code Review 报告

### 总体评价
[1-3 句话概述代码质量和主要问题]

### 🚫 Blocker（必须修复）
- [ ] \`file.ts:42\` 未校验用户输入直接拼接 SQL，存在注入风险
  建议：使用参数化查询

### ⚠️ Major（建议修复）
- [ ] \`service.ts:88\` N+1 查询：循环内调用数据库
  建议：改用批量查询 + Map 映射

### 💡 Minor（可选优化）
- [ ] \`utils.ts:15\` 变量名 \`d\` 含义不清晰
  建议：改为 \`duration\`

### ✅ 做得好的地方
- [值得肯定的设计或实现]

### 总结
Blocker: X 个 | Major: Y 个 | Minor: Z 个
\`\`\``,
    },
    {
      title: '5. 跟进确认',
      content: `- 如果有 Blocker，明确告知不应合并，等修复后重新 Review
- 如果只有 Minor，可以 Approve 并备注"建议改进但不阻塞"
- 对于设计层面的分歧，建议另开会议讨论，不在 PR 中反复拉锯`,
    },
  ],
  outputFormat:
    'Markdown 审查报告，含总体评价、分级问题列表（Blocker/Major/Minor）、亮点肯定和合并建议',
  examples: [
    {
      input: '帮我 review 这个登录接口的实现',
      output: `## Code Review 报告

### 总体评价
逻辑基本正确，但存在一个安全 Blocker（明文存储密码）和两个 Major 问题。

### 🚫 Blocker（必须修复）
- [ ] \`auth.ts:23\` 密码未加密直接存储数据库
  建议：使用 bcrypt 或 argon2 做哈希处理

### ⚠️ Major（建议修复）
- [ ] \`auth.ts:45\` 登录失败未做次数限制，易受暴力破解
  建议：引入 rate limiting 或账号锁定机制

### 总结
Blocker: 1 个 | Major: 1 个 | Minor: 0 个`,
    },
  ],
  notes: [
    'Review 的目的是提升代码质量，不是否定作者，保持建设性语气',
    'Blocker 必须明确标注，避免重要问题被忽视',
    '超过 400 行的 PR 建议拆分后分批 Review',
  ],
  category: '质量侧',
};
