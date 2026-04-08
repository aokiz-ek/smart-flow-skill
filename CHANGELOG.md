# Changelog

All notable changes to this project will be documented in this file.

## [1.13.0] - 2026-04-08

### Added

- **Multi-Agent 编排系统**（全新模块 `src/agents/`）：
  - 5 个内置角色 Agent：`architect`🏗️ / `coder`💻 / `reviewer`🔍 / `devops`🚀 / `pm`📊
  - 覆盖全部 36 个 Skill 的角色分配矩阵
  - 支持 `.ethan/agents/*.yaml|json` 自定义 Agent
  - `src/agents/orchestrator.ts` 核心编排函数 `buildMultiAgentPrompt()`
  - `src/loader/custom-agent-loader.ts` 自定义 Agent 加载器

- **新 CLI 命令 `ethan agent`**（3 个子命令）：
  - `ethan agent list` — 列出所有可用 Agent 及 Skill 分配
  - `ethan agent show <agentId>` — 查看指定 Agent 的详细配置
  - `ethan agent run [pipelineId]` — 生成 Multi-Agent 编排 Prompt（支持 `--context` / `--lang` / `--with-context` / `--no-copy`）

- **新 MCP 工具 `ethan_agent_orchestrate`**：
  - 通过 Claude Desktop 触发 Multi-Agent 编排
  - 参数：`pipelineId`（必填）、`context`（必填）、`lang`、`withContext`、`cwd`
  - 支持角色分工感的多阶段复杂任务协作

- **宣传落地页 `docs/landing.html`**（全新设计）：
  - 极简暗黑 + 霓虹风格，参考 superconscious.app
  - 8 大 Section：Hero / Stats / Before-After 对比 / 用户画像 / Features / Workflow Demo / Skills Marquee / 架构图 / 未来路线 / Install CTA
  - 鼠标 Spotlight / Blob 视差 / 终端打字动画 / Scroll Reveal / 数字计数动画
  - 完全响应式（375px / 768px / 1280px+）

### Changed

- MCP Server 工具总数：27 → **28**（新增 `ethan_agent_orchestrate`）
- CLI 命令总数新增 3 个 `agent` 子命令

### Tests

- 新增 `src/agents/orchestrator.test.ts`，Multi-Agent 编排模块测试覆盖

---

## [1.12.0] - 2026-04-07

### Added

- **12 new Skills** (total: 36):
  - `#25 spec-proposal` — OpenSpec 变更提案生成（proposal + design + tasks + spec delta）
  - `#26 spec-review` — 意图级 Spec 审查（对比 spec delta 与代码实现）
  - `#27 tech-debt` — 技术债识别、量化评估与偿还路线图
  - `#28 api-mock` — Mock 服务生成（MSW / JSON Server / Mirage.js 选型与配置）
  - `#29 data-migration` — 数据迁移助手（UP/DOWN 脚本、零停机四步法）
  - `#30 llm-feature` — LLM 功能设计（RAG 架构、Prompt 工程、评估与降级）
  - `#31 threat-model` — 威胁建模（STRIDE 矩阵、攻击树、安全控制）
  - `#32 green-code` — 绿色编码实践（能耗优化、碳排放估算）
  - `#33 service-catalog` — 服务目录管理（catalog-info.yaml、健康评分）
  - `#34 mobile-review` — 移动端专项审查（平台合规、性能、无障碍）
  - `#35 data-pipeline` — 数据管道设计（Batch/Streaming 选型、质量规则、血缘图）
  - `#36 ml-experiment` — ML 实验管理（MLflow/W&B、DVC、Model Card、部署监控）
- **4 new Pipelines** (total: 10):
  - `spec-workflow` — Spec Proposal → 方案设计 → 执行实现 → Spec Review
  - `bugfix-workflow` — 故障排查 → Spec Proposal → 执行实现 → 单元测试 → Spec Review
  - `security-audit-workflow` — 威胁建模 → 安全审查 → Spec Proposal → 执行实现 → Spec Review
  - `open-source-release` — 技术调研 → 代码审查 → 单元测试 → 部署上线
- **19 new CLI analysis commands**:
  `diff`, `deps`, `dora`, `pr-analytics`, `adr`, `mermaid`, `i18n`, `onboard`,
  `test-coverage`, `migrate`, `postmortem`, `decision-log`, `knowledge`,
  `oss`, `prompt-lib`, `scaffold`, `benchmark`, `sync`, `compliance`
- **5 new MCP tools** (total: 27):
  `ethan_dora`, `ethan_pr_analytics`, `ethan_postmortem`, `ethan_scaffold`, `ethan_compliance`
- OpenSpec 工具链: `ethan spec init/list/show/validate/proposal/review`
- 3 new MCP tools for OpenSpec: `ethan_spec_proposal`, `ethan_spec_review`, `ethan_spec_validate`

---

## [1.10.1] - 2026-04-02

### Added

- `ethan slash-install` 新增 12 条工作流 Slash 命令（4 分类）：
  - Git 集成: `commit`, `review`, `pr`, `standup`, `changelog`
  - 有状态工作流: `workflow-start`, `workflow-done`, `workflow-status`
  - Auto-Pilot: `auto`
  - 开发工具: `explain`, `test-case`, `estimate`
- Claude Code 模式下共生成 36 个 `.claude/commands/ethan-*.md` 文件

---

## [1.10.0] - 2026-04-02

### Added

- `ethan slash-install [--platform] [--dir]` — 一键生成平台专属 Slash 命令文件：
  - `claude-code`: 生成 `.claude/commands/ethan-{skill}.md` 每个 Skill 独立文件
  - 其他平台: 生成 `ethan-commands.md` 速查表（Skills + 触发词）
- 自动后台静默升级：检测到新版本后在后台执行 `npm install -g`，重启终端生效
- 启动时 Node.js 版本检测（≥18），版本过低显示友好错误框（含 nvm 升级命令）

---

## [1.9.0] - 2026-04-02

### Changed

- `ethan autopilot` 重命名为 `ethan auto`（保留 `autopilot` 别名兼容）

---

## [1.8.0] - 2026-04-01

### Added

- **10 new Skills** (total: 24), 覆盖工程质量全栈：
  - `#15 git-workflow` — GitFlow vs Trunk-Based 选型、Conventional Commits、Rebase vs Merge
  - `#16 unit-testing` — AAA 模式、TDD 工作流、Mock 策略、Vitest 覆盖率配置
  - `#17 system-design` — 需求澄清→容量估算→架构设计→核心组件→扩展性权衡
  - `#18 database-optimize` — Schema 审查、索引设计、慢查询分析、N+1 修复、分库分表
  - `#19 docker` — 多阶段构建、.dockerignore、Docker Compose 编排、安全加固
  - `#20 cicd` — GitHub Actions 完整配置、构建缓存、部署门控、自动回滚
  - `#21 performance` — Core Web Vitals 基线、前端懒加载/分割、后端缓存/并行优化
  - `#22 refactoring` — 12 种坏味道识别、重构手法、Strangler Fig 大规模重构
  - `#23 observability` — 日志/指标/链路三支柱、Prometheus + Grafana、OpenTelemetry、SLO
  - `#24 design-patterns` — 23 种 GoF 模式速查、高频模式 TypeScript 实现、场景选型指南
- ReactBits-inspired 文档 UI：极光背景 + 玻璃态卡片

---

## [1.7.0] - 2026-03-31

### Added

- **4 new Skills** (total: 14):
  - `#11 api-design` — RESTful/GraphQL 接口设计，错误码体系，OpenAPI 3.0 风格输出
  - `#12 security-review` — OWASP Top 10 逐项扫描，Critical/High/Medium/Low 四级输出
  - `#13 deployment` — Pre-flight 预检、灰度/蓝绿/滚动策略、上线后验证与回滚
  - `#14 prd` — 用户故事→验收标准（AC）→非功能性需求→埋点方案，完整 PRD 文档
- **3 new Pipelines** (total: 6):
  - `full-dev-cycle` — 需求理解 → 接口设计 → 方案设计 → 执行实现 → 代码审查 → 部署上线
  - `incident-response` — 故障排查 → 技术调研 → 任务报告
  - `new-feature` — PRD → 技术调研 → 接口设计 → 任务拆解 → 执行实现
- 自定义 Pipeline 加载器（`src/loader/custom-pipeline-loader.ts`）：`.ethan/pipelines/*.yaml` 自动加载

---

## [1.6.0] - 2026-03-26

### Added

- 自定义 Skill 支持 `.md` 格式（YAML frontmatter 定义元数据 + Markdown 正文定义步骤）
- `ethan skill new [name] --format md` 生成 Markdown 模板
- `##` / `###` 标题自动解析为步骤（title + content）
- 支持格式：`.yaml` / `.yml` / `.json` / `.md`，透明合并到 `ethan list`

---

## [1.5.9] - 2026-03-26

### Added

- **Context 引擎**（`src/context/builder.ts`）：
  - `buildProjectSnapshot()` 自动扫描项目技术栈、框架、配置文件
  - `ethan context show [--refresh] [--json]` — 展示项目快照（TTL 30min 缓存）
  - `ethan context refresh` — 强制刷新缓存
  - `autopilot --with-context` — 静默注入项目上下文到超级提示词
- **MCP Autopilot**：新增 `ethan_autopilot` 和 `ethan_context_snapshot` MCP 工具
- **Skill 质量评分**：
  - `workflow done --rating <1-5>` — 每次完成工作流后评分
  - `ethan quality report` — ASCII 条形图可视化各 Skill 质量评分

---

## [1.5.7] - 2026-03-26

### Fixed

- `prepublishOnly` 阶段先执行 `build`，修复 `autopilot` 命令 `dist/` 未更新问题

---

## [1.5.6] - 2026-03-25

### Added

- **Auto-Pilot 全自动链式工作流**（`ethan autopilot [pipelineId]`）：
  - 生成超级提示词，让 AI 无需人工确认自动链式执行整个 Pipeline
  - 支持 `--context` / `--all` / `--lang en` / `--no-copy` 参数
  - 所有平台规则文件同步更新 Auto-Pilot 协议（`<details>` 折叠中间步骤）

---

## [1.5.5] - 2026-03-23

### Changed

- `ethan workflow done` 简化：去除强制 summary，改为可选确认
- 工作流 UX 分级：P0（核心流）/ P1（推荐）/ P2（可选增强）

### Fixed

- Windows 路径反斜杠兼容（`test-case` / `explain` / `roast`）
- Windows 剪贴板乱码（改用 PowerShell `Set-Clipboard`）
- 跨平台模板变量注入问题（CodeBuddy / Lingma / Zed）

---

## [1.5.0] - 2026-03-22

### Added

- **MCP Server 完整工具集**（`src/mcp/server.ts`）：
  - 新增 `ethan_memory_search`、`ethan_estimate`、`ethan_git_commit`、`ethan_git_review`
  - 总计 17 MCP 工具（10 Skill 工具 + 7 实用工具）
- **浏览器扩展**（Chrome/Edge MV3）：
  - GitHub PR 页面注入「⚡ Ethan Review」按钮
  - 右键菜单快速生成 AI 提示词，一键复制到剪贴板
- **插件 OS**：`ethan plugin publish / registry / search` — 支持私有 npm 注册表
- **Stats 排行榜**：`ethan stats leaderboard` — 团队 Skill 使用频次排行
- **VS Code 扩展完整版**：
  - SkillTreeDataProvider + PipelineTreeDataProvider 侧边栏
  - Status Bar 按钮、QuickPick 技能选择、Web UI Dashboard 启动
  - 17 个 chatParticipant 命令（新增 commit/review/pr/standup/estimate/retro/oncall）
- 支持 11 个平台：新增 Windsurf、Zed、JetBrains、Continue、Claude Code

---

## [1.4.0] - 2026-03-22

### Added

- **Phase 4 — 团队工具**：
  - `ethan memory add/search/show/list/export/remove` — Skill 记忆库（`.ethan/memory/`，跨项目检索）
  - `workflow done` 自动归档当前步骤摘要到记忆库
  - `ethan estimate [-t task] [--style hours|story-points|t-shirt]` — PERT 三点估算
- **Phase 5 — 运维工具**：
  - `ethan retro [--sprint]` — Sprint 回顾提示词
  - `ethan stats leaderboard` — 使用频次排行（基于 `~/.ethan-stats.json`）
  - `ethan pipeline-init [--name]` — 生成自定义 Pipeline YAML 模板
  - `.ethan/pipelines/*.yaml` 自定义 Pipeline 加载

---

## [1.3.0] - 2026-03-22

### Added

- **Phase 1 — Git 集成**：`ethan commit / review / pr / standup / changelog`
- **Phase 2 — 开发工具**：`ethan scan / explain / test-case / naming / readme / roast`
- **Phase 3 — 运维工具**：`ethan oncall / schedule / hooks / stats show`
- 命名会话支持：`ethan workflow start --name <session>` — 支持多并行工作流会话
- Stats 追踪（v2）：连续使用天数 + 7 日热力图 + 徽章系统

---

## [1.2.0] - 2026-03-22

### Added

- `ethan workflow report` — 从当前会话生成 Markdown 工作流报告（含各步耗时、摘要）
- `--out <file>` 保存报告到文件；`--all` 包含待执行步骤

---

## [1.1.0] - 2026-03-22

### Added

- **一键工作流**（`ethan workflow start/done/status/reset/list`）：
  - 有状态的分步执行，每步完成后自动注入上下文链
  - `workflow done [summary]` — 标记完成并推进到下一步
- **Web UI Dashboard**（`ethan serve`）：
  - 工作流进度面板、可视化进度条、一键推进步骤
  - API 端点：`GET /api/workflow`、`POST /api/workflow/done`
- **MCP 工作流工具**：`ethan_workflow_status`、`ethan_workflow_next`

---

## [1.0.0] - 2026-03-21

### Added

- Initial release of Ethan cross-platform distribution package
- 7 standard workflow skills: 需求理解、任务拆解、方案设计、执行实现、进度跟踪、任务报告、周报生成
- Support for 4 distribution formats:
  - Markdown rule files for AI editors
  - npm package with CLI (`npx ethan`)
  - VS Code extension with `@ethan` chat participant
  - MCP Server with 7 tools (stdio transport)
- Support for 6 platform targets:
  - Cursor (new `.mdc` format with YAML frontmatter)
  - Cursor (legacy `.cursorrules`)
  - VS Code Copilot (`.github/copilot-instructions.md`)
  - Cline (`.clinerules`)
  - 通义灵码 Lingma (`.lingma/rules/*.md`)
  - 腾讯 CodeBuddy (`CODEBUDDY.md`)
- Single Source of Truth architecture: all content in `src/skills/*.ts`, built to `rules/`
- Trigger-based routing system
- Build scripts: `npm run build:all`, `npm run build:rules`, `npm run build:vscode`
