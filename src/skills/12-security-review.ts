import type { SkillDefinition } from './types';

export const securityReviewSkill: SkillDefinition = {
  id: 'security-review',
  name: '安全审查',
  nameEn: 'security_review',
  order: 12,
  description: '基于 OWASP Top 10 对代码和依赖进行安全扫描，识别漏洞并给出修复建议',
  descriptionEn: 'Security audit based on OWASP Top 10, covering code vulnerabilities and dependency risks',
  detailDescription: `对代码变更或系统模块进行安全专项审查，
覆盖 OWASP Top 10、依赖漏洞、密钥泄露、权限校验、数据加密等维度，
按 Critical/High/Medium/Low 四级输出风险列表和修复建议。`,
  triggers: [
    '安全审查',
    '安全扫描',
    '安全检查',
    '漏洞扫描',
    'security review',
    'security audit',
    'OWASP',
    '安全风险',
    '代码安全',
    '@ethan 安全',
    '@ethan security',
    '/安全审查',
  ],
  steps: [
    {
      title: '1. 确定审查范围',
      content: `- 明确审查对象：代码变更 / 整个模块 / 依赖包 / 部署配置
- 确认技术栈（Node.js / Java / Python / 前端框架等）
- 了解数据敏感程度：是否涉及 PII（用户个人信息）、金融数据
- 确认暴露面：公网 API / 内部服务 / 用户上传入口
- 收集现有安全策略（如 CSP、CORS 配置）`,
    },
    {
      title: '2. OWASP Top 10 逐项检查',
      content: `按 OWASP 2021 Top 10 逐项扫描：

**A01 失效的访问控制**
- 垂直越权：普通用户能否访问管理员接口？
- 水平越权：用户A能否读取用户B的数据？
- IDOR（不安全的直接对象引用）：接口参数是否直接暴露内部 ID？
- 前端隐藏菜单 ≠ 权限控制，后端必须强制校验

**A02 加密失效**
- 密码是否使用 bcrypt/argon2（禁止 MD5/SHA1）
- 传输层是否强制 HTTPS
- 敏感字段（身份证、银行卡）是否静态加密存储
- Cookie 是否设置 Secure + HttpOnly + SameSite

**A03 注入**
- SQL 注入：是否使用 ORM 参数化查询（禁止字符串拼接）
- XSS：用户输入是否经过 HTML 转义后再输出
- Command 注入：是否调用 shell 命令且参数含用户输入
- LDAP/XML/NOSQL 注入场景检查

**A04 不安全设计**
- 是否存在无限重试（暴力破解风险）
- 重要操作缺少二次确认（如删除账号、大额转账）
- 密码重置流程是否可被枚举

**A05 安全配置错误**
- 生产环境是否关闭 Debug 模式、详细错误堆栈
- 是否暴露 \`.env\`、\`.git\`、\`node_modules\` 等目录
- 默认账号/密码是否修改
- CORS 是否配置为 \`*\`（应按域名白名单）

**A06 自带缺陷和过时的组件**
- 运行 \`npm audit\` / \`pip-audit\` / \`mvn dependency-check\`
- 检查高危 CVE（CVSS ≥ 7.0）
- 框架和运行时是否在安全维护期内

**A07 身份识别和认证失败**
- JWT 是否验证签名和过期时间
- Session 是否在登出时服务端失效
- 多因素认证（MFA）是否支持

**A08 软件和数据完整性失败**
- 第三方 CDN 资源是否加 SRI（Subresource Integrity）
- CI/CD 管道是否允许未授权修改部署配置
- 序列化数据是否来自可信来源

**A09 安全日志和监控失败**
- 登录成功/失败是否记录 IP 和时间戳
- 高危操作（删除、权限变更）是否有审计日志
- 日志中是否意外记录了密码或 Token

**A10 服务端请求伪造（SSRF）**
- 接受 URL 参数的接口是否限制可访问的域名/IP
- 是否阻断对内网地址（10.x/172.x/192.168.x/127.x）的请求`,
    },
    {
      title: '3. 密钥与凭据扫描',
      content: `- 扫描代码中是否硬编码了：API Key、数据库密码、JWT Secret、云账号 AK/SK
- 检查 \`.env\` 文件是否被提交到 Git（查 \`.gitignore\`）
- 历史 commit 是否包含敏感信息（可用 \`git log -S "password"\` 搜索）
- 推荐工具：
  - \`gitleaks\` — 扫描 git 历史中的密钥
  - \`trufflehog\` — 高熵字符串检测
  - GitHub Secret Scanning（如在 GitHub 托管）`,
    },
    {
      title: '4. 依赖漏洞扫描',
      content: `根据技术栈运行对应命令：

\`\`\`bash
# Node.js
npm audit --audit-level=high
npx audit-ci --high

# Python
pip install pip-audit && pip-audit

# Java/Maven
mvn dependency-check:check

# Docker 镜像
trivy image your-image:tag
\`\`\`

重点关注：
- CVSS Score ≥ 7.0 的高危/严重漏洞
- 直接依赖优先修复（间接依赖通过升级父包解决）
- 有修复版本的立即升级，无修复的评估缓解措施`,
    },
    {
      title: '5. 按风险级别输出报告',
      content: `\`\`\`markdown
## 安全审查报告

**审查范围**：[模块/文件/PR]
**审查日期**：[日期]
**整体风险等级**：🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

### 🔴 Critical（立即修复，阻止上线）

- [ ] \`auth.ts:45\` SQL 注入漏洞：用户 ID 直接拼接查询字符串
  **修复**：使用 ORM 参数化查询 \`db.query('SELECT * FROM users WHERE id = ?', [id])\`
  **CVE**：— **CVSS**：9.8

### 🟠 High（本次迭代修复）

- [ ] \`upload.ts:23\` 文件上传未限制类型，可上传 .php 执行文件
  **修复**：白名单校验扩展名，并检查 MIME type

### 🟡 Medium（计划修复）

- [ ] 缺少登录频率限制（Rate Limiting），存在暴力破解风险
  **修复**：引入 express-rate-limit，5次失败后锁定15分钟

### 🟢 Low（建议改进）

- [ ] Session Cookie 缺少 SameSite=Strict 属性

### ✅ 已做好的安全措施
- [值得肯定的安全实践]

### 统计
Critical: X | High: Y | Medium: Z | Low: W
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 安全审查报告，含 OWASP 维度检查结果、风险级别（Critical/High/Medium/Low）、修复建议和优先级',
  examples: [
    {
      input: '帮我检查这个用户注册接口的安全问题',
      output: `## 安全审查报告

### 🔴 Critical
- [ ] 密码使用 MD5 明文存储
  修复：改用 bcrypt（saltRounds=12）

### 🟠 High
- [ ] 邮箱重复注册返回 "邮箱已被注册"，可被枚举已注册用户
  修复：统一返回 "注册成功，请查收验证邮件"

### 🟢 Low
- [ ] 注册成功后在响应中返回了 passwordHash 字段
  修复：注册响应体移除敏感字段`,
    },
  ],
  notes: [
    'Critical 问题必须在上线前修复，不接受任何例外',
    '前端安全校验只是 UX 辅助，所有安全逻辑必须在后端实现',
    '依赖漏洞扫描建议加入 CI 流程自动运行（每次 PR 触发）',
    '安全审查不能替代专业渗透测试，重大系统上线前建议委托专业团队',
  ],
  category: '质量侧',
};
