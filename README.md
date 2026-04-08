# Ethan — Your AI Workflow Assistant

> 将工作流标准化为可分发的 AI Skill，覆盖开发全链路——从需求理解到代码发布，每一步都有据可依。

[![npm](https://img.shields.io/npm/v/ethan-skill)](https://www.npmjs.com/package/ethan-skill)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

🌐 **官网**：[aokiz-ek.github.io/smart-flow-skill](https://aokiz-ek.github.io/smart-flow-skill/)

---

## 功能一览

| 模块 | 内容 |
|------|------|
| **36 个 Skill** | 标准化工作流节点，覆盖需求→接口设计→安全→部署→PRD→Git→测试→系统设计→数据库→Docker→CI/CD→性能→重构→可观测性→设计模式→OpenSpec→技术债→Mock→数据迁移→LLM设计→威胁建模→绿色编码→服务目录→移动审查→数据管道→ML实验 |
| **11 个平台** | Cursor / Copilot / Cline / Windsurf / Zed / JetBrains / Continue / Claude Code 等 |
| **10 个 Pipeline** | 链式工作流（开发 / 汇报 / 质量 / 完整周期 / 故障响应 / 新功能 / Spec规范 / Bug修复 / 安全审计 / 开源发布），有状态持久化推进 |
| **28 个 MCP 工具** | AI 编辑器原生调用 Skill、Pipeline、Git、记忆库、估算、DORA 指标、PR 分析、故障复盘、脚手架、合规证据 |
| **60+ CLI 命令** | Git 集成、开发工具、记忆库、估算、分析工具（diff/deps/dora/mermaid/adr/i18n/migrate/onboard/compliance 等）、插件 OS 全覆盖 |
| **Slash 命令生成** | `ethan slash` 一键为 Claude Code 生成 `/ethan-xxx` 原生命令，其他平台生成速查表 |
| **自动升级** | 检测到新版本时自动后台 `npm install -g` 静默升级，重启终端即用新版 |
| **自定义 Skill** | `.ethan/skills/*.yaml/.md`，YAML frontmatter + Markdown body |
| **自定义 Pipeline** | `.ethan/pipelines/*.yaml`，引用内置或自定义 Skill 自由组合 |
| **浏览器扩展** | Chrome/Edge MV3，GitHub PR 一键 Review + 右键菜单 |
| **VS Code 扩展** | 侧边栏树、20 个命令、36 个 @ethan 斜杠命令 |
| **插件 OS** | 发布/搜索/安装社区 Skill 插件，支持私有注册表 |

---

## 36 个 Skill

| # | Skill | 分类 | 触发词（示例） | 说明 |
|---|-------|------|--------------|------|
| 1 | 需求理解 | 需求侧 | `需求理解`、`分析需求` | 深度解析需求，消除歧义，输出结构化需求文档 |
| 2 | 任务拆解 | 需求侧 | `任务拆解`、`拆解任务` | 将需求拆解为原子任务，建立依赖关系 |
| 3 | 方案设计 | 执行侧 | `方案设计`、`技术方案` | 输出架构设计、接口设计、数据模型 |
| 4 | 执行实现 | 执行侧 | `执行实现`、`开始实现` | 按设计方案逐步实现，含代码自检清单 |
| 5 | 进度跟踪 | 跟踪侧 | `进度跟踪`、`进度更新` | 实时更新任务状态，识别阻塞风险 |
| 6 | 任务报告 | 输出侧 | `任务报告`、`生成报告` | 生成成果报告含问题复盘和经验教训 |
| 7 | 周报生成 | 输出侧 | `周报`、`生成周报` | 自动生成结构化周报，突出业务价值 |
| 8 | 代码审查 | 质量侧 | `代码审查`、`code review`、`CR` | 系统性审查，分级输出 Blocker/Major/Minor |
| 9 | 故障排查 | 质量侧 | `故障排查`、`debug`、`线上故障` | 假设验证 + 5 Why 根因分析，三层解决方案 |
| 10 | 技术调研 | 需求侧 | `技术调研`、`技术选型`、`POC` | 加权评分矩阵 + POC 验证，输出有据可查的结论 |
| 11 | 接口设计 | 执行侧 | `接口设计`、`API 设计`、`RESTful` | RESTful/GraphQL 接口规范，OpenAPI 3.0 风格输出 |
| 12 | 安全审查 | 质量侧 | `安全审查`、`OWASP`、`security review` | OWASP Top 10 逐项扫描，四级风险清单（Critical→Low） |
| 13 | 部署上线 | 执行侧 | `部署上线`、`上线`、`deploy` | Pre-flight 预检 + 灰度/蓝绿策略 + 回滚方案全流程 |
| 14 | PRD 编写 | 需求侧 | `PRD`、`产品需求`、`写 PRD` | 用户故事 + 验收标准 AC + 非功能性需求 + 埋点方案 |
| 15 | Git 工作流 | 执行侧 | `Git 工作流`、`分支策略`、`commit 规范` | GitFlow/Trunk-Based 选型、Conventional Commits、Rebase vs Merge 决策 |
| 16 | 单元测试 | 质量侧 | `单元测试`、`unit test`、`测试覆盖率` | AAA 模式、Mock 策略、Vitest/Jest 配置，建立测试文化 |
| 17 | 系统设计 | 执行侧 | `系统设计`、`架构设计`、`system design` | 需求拆解→容量估算→架构选型→核心组件→数据模型 |
| 18 | 数据库优化 | 质量侧 | `数据库优化`、`慢查询`、`索引优化` | 慢查询诊断、索引策略、查询优化、分库分表与缓存 |
| 19 | Docker | 执行侧 | `Docker`、`容器化`、`Dockerfile` | 多阶段构建、Compose 编排、安全加固与镜像精简 |
| 20 | CI/CD | 执行侧 | `CI/CD`、`流水线`、`GitHub Actions` | GitHub Actions 全流程、并行构建、多环境部署策略 |
| 21 | 性能优化 | 质量侧 | `性能优化`、`Core Web Vitals`、`performance` | 基线建立、前端懒加载/代码分割、后端缓存/并发优化 |
| 22 | 代码重构 | 质量侧 | `代码重构`、`refactoring`、`技术债` | 识别坏味道、提炼函数/多态等重构手法、测试先行 |
| 23 | 可观测性 | 质量侧 | `可观测性`、`监控`、`链路追踪` | 日志/指标/链路三支柱、OTel、Prometheus+Grafana、SLO |
| 24 | 设计模式 | 执行侧 | `设计模式`、`design pattern`、`GoF` | 23 种 GoF 模式速查、TypeScript 实现、场景→模式选型指南 |
| 25 | **Spec Proposal** | 需求侧 | `spec proposal`、`变更提案`、`/spec-proposal` | 遵循 OpenSpec 规范生成变更提案包（proposal + design + tasks + spec delta） |
| 26 | **Spec Review** | 质量侧 | `spec review`、`意图审查`、`/spec-review` | 对比 spec delta 与代码实现，执行意图级 Review（非逐行审查） |
| 27 | **技术债追踪** | 质量侧 | `技术债`、`tech debt`、`@ethan tech-debt` | 技术债识别分类、量化评估、Sprint 偿还路线图、预防门禁 |
| 28 | **Mock 服务生成** | 执行侧 | `api mock`、`mock service`、`@ethan api-mock` | MSW/JSON Server/Mirage.js 选型 + handlers.ts + faker.js 动态数据 |
| 29 | **数据迁移** | 执行侧 | `数据迁移`、`data migration`、`schema migration` | UP/DOWN 脚本、checksum 验证、零停机四步法（扩列→双写→切流→清旧列） |
| 30 | **LLM 功能设计** | 需求侧 | `llm feature`、`rag`、`ai 功能设计` | RAG 架构设计、Prompt 工程规范、自动 Evals、幻觉控制与 Fallback |
| 31 | **威胁建模** | 质量侧 | `威胁建模`、`threat model`、`STRIDE` | STRIDE 威胁识别、攻击树、安全控制措施、残余风险登记 |
| 32 | **绿色编码** | 质量侧 | `绿色编码`、`green code`、`carbon footprint` | 能耗热点识别、Big-O 优化、云资源 Right-sizing、SCI 碳排放估算 |
| 33 | **服务目录** | 执行侧 | `服务目录`、`service catalog`、`backstage` | catalog-info.yaml 生成、服务依赖关系图、健康评分卡、生命周期管理 |
| 34 | **移动端审查** | 质量侧 | `移动端审查`、`mobile review`、`flutter review` | iOS/Android 平台合规、性能专项、无障碍 VoiceOver/TalkBack、崩溃防护 |
| 35 | **数据管道** | 执行侧 | `数据管道`、`data pipeline`、`etl` | Batch/Streaming 架构选型、数据质量规则、容错重试、血缘可观测性 |
| 36 | **ML 实验管理** | 执行侧 | `ml experiment`、`mlops`、`model training` | MLflow/W&B 追踪配置、DVC 数据版本控制、Model Card、A/B 部署监控 |

---

## 10 个 Pipeline（链式工作流）

| Pipeline ID | Skills | 适用场景 |
|-------------|--------|---------|
| `dev-workflow` | 需求理解 → 任务拆解 → 方案设计 → 执行实现 | 常规功能开发 |
| `reporting` | 进度跟踪 → 任务报告 → 周报生成 | 项目汇报 |
| `quality-workflow` | 代码审查 → 故障排查 | 质量保障 |
| `full-dev-cycle` | 需求理解 → **接口设计** → 方案设计 → 执行实现 → 代码审查 → **部署上线** | 完整功能交付 |
| `incident-response` | 故障排查 → 技术调研 → 任务报告 | 线上故障处理 |
| `new-feature` | **PRD** → 技术调研 → **接口设计** → 任务拆解 → 执行实现 | 新功能从 0 到 1 |
| `spec-workflow` | **Spec Proposal** → 方案设计 → 任务拆解 → 执行实现 → **Spec Review** | OpenSpec 规范开发 |
| `bugfix-workflow` | 故障排查 → **Spec Proposal** → 执行实现 → 单元测试 → **Spec Review** | 规范化 Bug 修复 |
| `security-audit-workflow` | **威胁建模** → **安全审查** → **Spec Proposal** → 执行实现 → **Spec Review** | 端到端安全审计 |
| `open-source-release` | 技术调研 → 代码审查 → 单元测试 → 部署上线 | 开源项目规范发布 |

自定义 Pipeline：在 `.ethan/pipelines/` 目录创建 YAML 文件，`ethan pipeline-init` 生成模板。

---

## 快速开始

### 方式一：规则文件（推荐）

```bash
# 安装到当前项目（自动检测平台）
npx ethan-skill install --platform cursor

# 安装到多个平台
npx ethan-skill install --platform copilot
npx ethan-skill install --platform windsurf

# 生成英文版规则文件
npx ethan-skill install --platform cursor --lang en
```

### 方式二：MCP Server（AI 编辑器原生集成）

在 MCP 配置文件（如 `~/.cursor/mcp.json`）中添加：

```json
{
  "mcpServers": {
    "ethan": {
      "command": "npx",
      "args": ["ethan-skill", "mcp"]
    }
  }
}
```

重启 AI 编辑器后，可使用全部 **28 个 MCP 工具**（详见下方 MCP 工具列表）。

### 方式三：全局安装

```bash
npm install -g ethan-skill
ethan install --platform cursor
```

---

## 支持的 11 个平台

| 平台 | 参数 | 安装目标文件 |
|------|------|------------|
| Cursor（新版） | `cursor` | `.cursor/rules/smart-flow.mdc` |
| Cursor（旧版） | `cursor` | `.cursorrules` |
| VS Code Copilot | `copilot` | `.github/copilot-instructions.md` |
| Cline | `cline` | `.clinerules` |
| 通义灵码 | `lingma` | `.lingma/rules/smart-flow.md` |
| 腾讯 CodeBuddy | `codebuddy` | `CODEBUDDY.md` |
| Windsurf | `windsurf` | `.windsurf/rules/smart-flow.md` |
| Zed | `zed` | `smart-flow.rules` |
| JetBrains AI | `jetbrains` | `.github/ai-instructions.md` |
| Continue | `continue` | `.continuerules` |
| Claude Code | `claude-code` | `CLAUDE.md` |

---

## CLI 命令参考

### 核心命令

```bash
ethan install [--platform <platform>] [--lang en]   # 安装规则文件
ethan slash [--platform <platform>]                  # 生成平台专属 Slash 命令文件
ethan list [--json]                                  # 列出所有 Skill（含自定义）
ethan run                                            # 交互式 Skill 执行向导
ethan init                                           # 生成 .ethanrc.json 配置文件
ethan validate                                       # 校验 rules/ 与源码是否同步
ethan doctor                                         # 环境与依赖健康检查
ethan mcp                                            # 启动 MCP Server
ethan serve                                          # 启动本地 Web UI Dashboard
```

### Git 集成（Phase 1）

```bash
ethan commit [--type <type>]                         # 读取 staged diff → Conventional Commit 提交信息
ethan review [--base <branch>]                       # 读取分支 diff → Blocker/Major/Minor Code Review
ethan pr [--template feature|bugfix|hotfix]          # 生成 PR 标题 + 正文 + Checklist
ethan standup [--days <n>] [--format]                # 根据提交历史生成站会发言稿
ethan changelog [--from <tag>] [--to <tag>]          # 生成两 tag 间的 CHANGELOG
```

### 开发工具（Phase 2）

```bash
ethan scan [--todo] [--deps]                         # 扫描 TODO/FIXME 或检查依赖安全漏洞
ethan explain [file] [--lines <range>] [--level <level>]  # 解释代码（junior/senior/principal）
ethan test-case <file> [--framework vitest] [--coverage]  # 生成单元测试提示词
ethan naming <description> [--style] [--lang] [--count]   # 生成命名候选（camelCase/snake_case/...）
ethan readme [--template library|cli|service]        # 扫描项目结构生成 README 草稿
ethan roast [file] [--pr] [--level mild|spicy|savage] # 幽默吐槽代码质量
```

### 工作流（有状态推进）

```bash
ethan workflow start <pipeline> -c "任务描述" [--name <session>]  # 启动工作流会话（支持命名会话）
ethan workflow done "本步摘要" [--name <session>]                  # 完成当前步骤，推进下一步
ethan workflow status [--name <session>]                           # 查看进度看板
ethan workflow reset [--name <session>]                            # 清除当前会话
ethan workflow list [--sessions]                                    # 列出 Pipeline / 命名会话
```

### 运维增强（Phase 3）

```bash
ethan oncall [--severity P0|P1|P2] [--postmortem]    # 生成 On-call 排查 SOP
ethan schedule add --cron "0 9 * * 1" --cmd "ethan standup"  # 添加定时任务
ethan schedule list                                   # 查看定时任务
ethan schedule remove <id>                            # 删除定时任务
ethan hooks install [--hook pre-commit|commit-msg]    # 安装 Git Hook
ethan hooks list                                      # 查看已安装 Hook
ethan hooks remove <hook>                             # 移除 Git Hook
```

### Skill 记忆库（Phase 4）

```bash
ethan memory add --title "..." --content "..." [--tags tag1,tag2]  # 添加记忆条目
ethan memory search <keyword>                         # 全文搜索（标题/内容/标签）
ethan memory show <id>                                # 查看详情
ethan memory list [--type workflow|skill|custom]      # 列出所有条目
ethan memory export [--output file.md]                # 导出为 Markdown
ethan memory remove <id>                              # 删除条目
```

> 工作流完成后（`ethan workflow done`）自动将步骤摘要归档到记忆库，无需手动添加。

### 估算与复盘（Phase 4）

```bash
ethan estimate [--style hours|story-points|days] [--team <size>]  # 三点估算 + T-shirt Size
ethan retro [--format 4l|ssc] [--from-workflow]       # 生成迭代复盘提示词
```

### 统计与排行（Phase 5）

```bash
ethan stats show                                      # 查看个人使用频次（ASCII 条形图）+ 连续天数
ethan stats leaderboard                               # 团队排行榜（~/.ethan-leaderboard.json）
ethan stats reset                                     # 清空统计数据
```

### Pipeline 管理

```bash
ethan pipeline list                                   # 列出所有内置 + 自定义 Pipeline
ethan pipeline run <id> [-c "上下文"]                 # 运行 Pipeline
ethan pipeline-init [--name my-pipeline]              # 生成自定义 YAML Pipeline 模板
```

### 自定义 Skill

```bash
ethan skill new [name] [--format yaml|md]             # 生成自定义 Skill 模板（默认 yaml）
ethan skill list                                      # 列出 .ethan/skills/ 中的自定义 Skill
```

自定义 Skill 文件放置在 `.ethan/skills/` 目录，支持 `.yaml`、`.json`、`.md` 格式：

```markdown
---
id: my-skill
name: 自定义技能
nameEn: my_skill
description: 一句话描述
triggers:
  - 触发词
outputFormat: Markdown 文档
---

## 1. 第一步

步骤说明...

## 2. 第二步

步骤说明...
```

### 分析工具（Phase 7）

```bash
ethan diff [base] [head]                              # 读取 git diff → 变更风险分析提示词
ethan deps [--fix]                                    # 依赖健康报告（package.json + audit）
ethan dora [--since <days>]                           # DORA 四键指标统计（Elite/High/Medium/Low）
ethan pr-analytics [--days <n>]                       # PR 大小分布、热点文件 Top10 分析
ethan adr new|list|show                               # 管理架构决策记录（docs/adr/）
ethan mermaid [--type] [--desc]                       # 生成 Mermaid 图表提示词（flow/sequence/er 等）
ethan i18n [file]                                     # 扫描硬编码字符串 → i18n key 提取提案
ethan onboard [--lang]                                # 生成新成员上手文档提示词
ethan test-coverage [--threshold]                     # 读取覆盖率报告 → 覆盖率优化提示词
ethan migrate --from <src> --to <dest>                # 生成框架/工具迁移方案提示词
ethan postmortem [--incident]                         # 从 git + 记忆库生成故障复盘提示词
ethan decision-log new|list|search                    # 管理轻量技术决策记录（.ethan/decisions/）
ethan knowledge add|list|search                       # 管理团队知识库（.ethan/team-knowledge/）
ethan oss triage|release-notes|contributor-guide|health-score  # 开源项目工具套件
ethan prompt-lib add|list|search|show                 # 管理 Prompt 资产库（.ethan/prompts/）
ethan scaffold [--template] [--list]                  # 黄金路径脚手架（5 个内置模板）
ethan benchmark [--skill]                             # 基于 rating 数据生成 Skill 质量基准报告
ethan sync push|pull                                  # 配置同步到 git .ethan-config 分支
ethan compliance [--standard soc2|gdpr|iso27001]      # 生成合规证据收集提示词
```

### 插件 OS（Phase 6）

```bash
ethan plugin install <pkg>                            # 从 npm 安装社区 Skill 插件
ethan plugin publish [--dry-run]                      # 发布本地插件到 npm / 私有注册表
ethan plugin registry --set <url>                     # 配置私有插件注册表
ethan plugin registry --show                          # 查看当前注册表配置
ethan plugin search <keyword> [-n <limit>]            # 搜索社区插件（ethan-skill-*）
```

---

## Slash 命令生成（`ethan slash`）

为各 AI 平台生成专属 Slash 命令配置文件，让 `/ethan-commit`、`/ethan-review` 等命令直接在 AI 聊天中可用：

```bash
# Claude Code：生成 .claude/commands/ethan-{skill}.md × 36 个原生 slash 命令
ethan slash --platform claude-code

# CodeBuddy：生成 .codebuddy/commands/ethan-{skill}.md × 36 个命令文件
ethan slash --platform codebuddy

# Cursor / Copilot / Windsurf 等：生成 ethan-commands.md 速查表
ethan slash --platform cursor
ethan slash --platform copilot

# 全平台一键生成
ethan slash
```

**Claude Code 使用方式**：安装后在对话中直接输入 `/ethan-commit`、`/ethan-review`、`/ethan-auto` 等，共 **36 个命令**（36 Skills + 工作流命令）。

工作流命令支持**动态注入**：执行时自动读取真实的 git diff / 项目上下文，生成提示词并直接注入到对话中，**无需手动复制粘贴**。例如：

```
/ethan-commit          # 自动读取 staged diff → 生成 Conventional Commit 并注入对话
/ethan-review          # 自动读取分支 diff → 生成 Code Review 报告并注入对话
/ethan-auto dev-workflow -c "实现用户登录"  # 生成 Pipeline 超级 prompt 并注入
/ethan-workflow-start dev-workflow -c "任务"  # 启动有状态工作流
```

**其他平台**：在 AI 聊天框输入 `/ethan-{skill-id}` 或 `@ethan {skill-id}`，参考生成的 `ethan-commands.md` 速查表。

---

## 自动升级

Ethan 每次启动都会静默检查 npm 最新版本（24h 缓存，不阻塞 CLI）。检测到新版本后，**自动在后台执行 `npm install -g ethan-skill@latest`**，退出时显示：

```
🔄  Ethan 正在后台自动升级到 v{latest}，重启终端后生效。
```

无需手动运行升级命令，始终保持最新版本。

---

## 28 个 MCP 工具

配置 MCP Server 后，AI 编辑器（Cursor / Cline / Continue 等）可直接调用：

| 工具名 | 说明 |
|--------|------|
| `requirement_understanding` | 需求理解 Skill |
| `task_breakdown` | 任务拆解 Skill |
| `solution_design` | 方案设计 Skill |
| `implementation` | 执行实现 Skill |
| `progress_tracking` | 进度跟踪 Skill |
| `task_report` | 任务报告 Skill |
| `weekly_report` | 周报生成 Skill |
| `code_review` | 代码审查 Skill |
| `debug` | 故障排查 Skill |
| `tech_research` | 技术调研 Skill |
| `api_design` | 接口设计 Skill |
| `security_review` | 安全审查 Skill |
| `deployment` | 部署上线 Skill |
| `prd` | PRD 编写 Skill |
| `ethan_pipeline` | 串联执行完整 Pipeline |
| `ethan_workflow_next` | 推进工作流到下一步（传入摘要，返回下一步提示词）|
| `ethan_workflow_status` | 查询工作流进度与当前步骤 |
| `ethan_memory_search` | 搜索 Skill 记忆库（项目级 + 全局）|
| `ethan_estimate` | 生成三点估算提示词（支持小时/故事点/人天）|
| `ethan_git_commit` | 读取 staged diff → Conventional Commit 提示词 |
| `ethan_git_review` | 读取分支 diff → Blocker/Major/Minor Review 提示词 |
| `ethan_autopilot` | 生成 Pipeline 超级 prompt（自动链式执行）|
| `ethan_context_snapshot` | 采集项目快照（技术栈/git/目录树，TTL 30min 缓存）|
| `ethan_spec_proposal` | 生成 OpenSpec 变更提案包（v1.11.0 新增）|
| `ethan_spec_review` | 意图级代��审查（对比 spec delta 与代码实现，v1.11.0 新增）|
| `ethan_spec_validate` | 校验 OpenSpec 结构（REQ 编号/GIVEN-WHEN-THEN，v1.11.0 新增）|
| `ethan_dora` | 统计 DORA 四键指标（部署频率/变更失败率/MTTR/前置时间，v1.12.0 新增）|
| `ethan_pr_analytics` | PR 健康度分析（大小分布/热点文件，v1.12.0 新增）|
| `ethan_postmortem` | 生成故障复盘提示词（v1.12.0 新增）|
| `ethan_scaffold` | 黄金路径脚手架提示词（v1.12.0 新增）|
| `ethan_compliance` | 生成合规证据收集清单（soc2/gdpr/iso27001，v1.12.0 新增）|

---

## 浏览器扩展

Chrome/Edge Manifest V3 扩展，将 Ethan 带入任意网页。

**功能：**
- **GitHub PR 一键 Review**：访问 PR 页面自动注入「⚡ Ethan Review」按钮，提取 PR 上下文生成完整 Code Review 提示词
- **右键菜单**：选中代码/文本 → 右键 → Ethan → Review / Explain / Naming / PR Review
- **Popup 面板**：6 个快捷操作 + 9 个 Skill 快捷按钮，所有提示词一键复制到剪贴板
- **纯本地**：无服务器、无账号，所有提示词在本地生成

**安装（开发者模式）：**

1. Clone 仓库或下载 `browser-extension/` 目录
2. Chrome/Edge → `chrome://extensions/` → 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `browser-extension/` 目录

---

## VS Code 扩展

**安装：**
1. 下载 `dist/ethan-skill-*.vsix`
2. VS Code → Extensions → `...` → Install from VSIX

**功能：**
- **Skill 侧边栏树**：按分类分组展示 36 个 Skill，点击直接运行
- **Pipeline 侧边栏树**：展示 10 条 Pipeline，点击查看详情
- **36 个 @ethan 斜杠命令**：在 Copilot Chat 中使用 `@ethan /需求理解`、`@ethan /commit` 等
- **20 个命令面板命令**：包含 Git、开发工具、记忆、估算、复盘等全系列
- **状态栏快捷按钮**：底部状态栏 `⚡ Ethan`，单击打开 Skill 选择器

---

## 项目配置（`.ethanrc.json`）

```bash
ethan init   # 在当前目录生成配置文件
```

```json
{
  "lang": "zh",
  "disabledSkills": ["weekly-report"],
  "customTriggers": { "需求": "requirement-understanding" },
  "plugins": ["ethan-skill-agile"],
  "registry": "https://your-private-registry.com"
}
```

---

## 架构设计

### 单一数据源（Single Source of Truth）

```
src/skills/*.ts  ──→  [build-rules.ts]  ──→  rules/cursor/smart-flow.mdc
                                         ──→  rules/copilot/copilot-instructions.md
                                         ──→  rules/cline/.clinerules
                                         ──→  rules/windsurf/.windsurf/rules/smart-flow.md
                                         ──→  rules/zed/smart-flow.rules
                                         ──→  rules/jetbrains/smart-flow.md
                                         ──→  rules/continue/.continuerules
                                         ──→  rules/claude-code/CLAUDE.md
                                         ──→  ... （共 11 个平台）
```

### 目录结构

```
ethan-skill/
├── src/
│   ├── skills/            # 单一数据源（36 Skill + pipeline 定义）
│   │   ├── types.ts       # SkillDefinition、Platform、PipelineDefinition
│   │   ├── index.ts       # ALL_SKILLS 导出
│   │   ├── pipeline.ts    # PIPELINES（10条）+ resolvePipeline()
│   │   └── 01~36-*.ts     # 各 Skill 定义（含 category、nextSkill）
│   ├── cli/               # 60+ CLI 命令入口
│   │   ├── index.ts       # Commander.js 主程序
│   │   └── config.ts      # .ethanrc.json 读写
│   ├── git/               # Git 工具函数
│   │   └── utils.ts       # getStagedDiff / getBranchDiff / truncateDiff 等
│   ├── workflow/           # 有状态工作流引擎
│   │   └── state.ts       # 会话持久化、Named Sessions、步骤推进
│   ├── mcp/               # MCP Server（28 个工具）
│   │   └── server.ts
│   ├── router/            # 触发词路由
│   ├── templates/         # 各平台渲染模板（11 个 case，强制穷举）
│   ├── context/           # 项目技术栈自动检测
│   ├── loader/            # 自定义 Skill/Pipeline 加载器
│   │   ├── custom-skill-loader.ts    # .ethan/skills/*.yaml/.md
│   │   └── custom-pipeline-loader.ts # .ethan/pipelines/*.yaml
│   ├── server/            # Web UI Dashboard
│   └── vscode/            # VS Code 扩展
├── browser-extension/     # Chrome/Edge MV3 扩展
├── vscode-extension/      # VS Code 扩展 manifest（20 命令、36 斜杠命令）
├── rules/                 # 构建产物，11 个平台（提交到仓库）
├── docs/                  # 官网（GitHub Pages）
├── scripts/build/         # 构建脚本（build-rules.ts / build-vscode.ts）
└── .ethan/                # 项目级运行时数据（workflow.json、memory/、skills/、pipelines/）
```

---

## 开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 常用命令

```bash
npm install              # 安装依赖
npm run build            # 编译 TypeScript → dist/
npm run build:rules      # 生成 11 个平台规则文件
npm run build:all        # 全量构建（build + build:rules）
npm run dev              # 监视模式编译

npm run lint             # ESLint 检查
npm run lint:fix         # ESLint 自动修复
npm run format           # Prettier 格式化

npm test                 # 运行所有测试（Vitest）
npm run test:watch       # 监视模式
npm run test:coverage    # 覆盖率报告
```

### 修改 Skill 内容

1. 编辑 `src/skills/0X-skill-name.ts`
2. `npm run build:rules` 重新生成规则文件
3. `npm test` 确认测试通过
4. 提交 `src/` 和 `rules/` 目录变更

### 添加新 Skill

1. 创建 `src/skills/0X-new-skill.ts`，实现 `SkillDefinition`（含 `category`、`nextSkill`）
2. 在 `src/skills/index.ts` 的 `ALL_SKILLS` 末尾追加
3. `npm run build:rules && npm test`

### 添加新平台

1. 在 `src/skills/types.ts` 的 `Platform` 联合类型添加新值
2. 在 `src/templates/copilot-md.template.ts` 的 `switch` 中添加 `case`（无 `default`，TypeScript 强制穷举）
3. 在 `scripts/build/build-rules.ts` 添加 `writeFile` 调用
4. 在 `src/cli/index.ts` 的 `platformMap` 添加安装路径

---

## 版本历史

| 版本 | 主要变更 |
|------|---------|
| **v1.14.0** | 新增 3 个专业化 Agent（qa/security/data），内置 Agent 5 → 8；新增 4 种协作模式（`--mode sequential/parallel/review-loop/consensus`）；新增 `ethan agent new` 交互式创建自定义 Agent；新增 MCP 工具 `ethan_agent_list/show`，MCP 工具 28 → 30 |
| **v1.13.0** | Multi-Agent 编排系统（`src/agents/`）；5 个内置角色 Agent（architect/coder/reviewer/devops/pm）；新增 `ethan agent list/show/run` CLI；新增 MCP 工具 `ethan_agent_orchestrate`；MCP 工具 27 → 28；新增宣传落地页 `docs/landing.html` |
| **v1.12.0** | 新增 10 个 Skill（技术债/Mock服务/数据迁移/LLM设计/威胁建模/绿色编码/服务目录/移动审查/数据管道/ML实验）；Skills 26 → 36；新增 3 条 Pipeline（bugfix/security-audit/open-source-release）；新增 19 个分析 CLI 命令（diff/deps/dora/adr/mermaid/i18n/onboard/migrate/postmortem/decision-log/knowledge/oss/prompt-lib/scaffold/benchmark/sync/compliance 等）；MCP 工具 22 → 27 |
| **v1.11.0** | 新增 2 个 Skill（Spec Proposal/Spec Review）；新增 OpenSpec 工具链（spec init/list/show/validate/proposal/review）；新增 spec-workflow Pipeline；MCP 新增 ethan_spec_proposal/review/validate 3 个工具 |
| **v1.10.3** | 修正 CodeBuddy slash 命令安装目录为 `.codebuddy/commands/`，生成 36 个独立命令文件（同 Claude Code 模式） |
| **v1.10.2** | Claude Code 工作流 Slash 命令改为动态注入（`$(!ethan commit --no-copy)` bash 替换），执行时自动读取 git diff / 项目上下文并注入对话，无需手动复制粘贴 |
| **v1.10.1** | `ethan slash` 新增 12 个工作流 Slash 命令（commit/review/pr/standup/changelog/workflow-start/done/status/auto/explain/test-case/estimate）|
| **v1.10.0** | Node 版本过低时友好提示；新增 `ethan slash` 为各平台生成专属 Slash 命令文件；检测到新版本时自动后台静默升级 |
| **v1.9.0** | `ethan autopilot` 命令重命名为 `ethan auto`（原命令保留为别名兼容） |
| **v1.8.0** | 新增 10 个 Skill（Git 工作流/单元测试/系统设计/数据库优化/Docker/CI/CD/性能优化/代码重构/可观测性/设计模式）；Skills 14 → 24；docs ReactBits 风格重设计 |
| **v1.7.0** | 新增 4 个 Skill（接口设计/安全审查/部署上线/PRD 编写）；新增 3 条 Pipeline（full-dev-cycle/incident-response/new-feature）；自定义 Pipeline 加载（`.ethan/pipelines/`）；MCP 工具 19 → 23 |
| **v1.6.0** | 自定义 Skill 支持 `.md` 格式（YAML frontmatter + Markdown body）；`ethan skill new --format md`；新增 MCP `ethan_autopilot` 和 `ethan_context_snapshot` 工具 |
| **v1.5.0** | MCP 新增 4 工具（git commit/review/memory search/estimate）；VS Code 扩展 17 斜杠命令；插件 OS；浏览器扩展；Context 引擎；Stats 排行榜；记忆库；估算复盘 |
| **v1.3.0** | Git 集成（commit/review/pr/standup/changelog）；开发工具（scan/explain/test-case/naming/readme/roast）；On-call、定时任务、Git Hooks |
| **v1.2.0** | 新增代码审查、故障排查、技术调研 3 个 Skill；新增 Windsurf/Zed/JetBrains/Continue/Claude Code 5 个平台；validate/pipeline/doctor/stats 命令 |
| **v1.1.0** | 有状态工作流（workflow start/done/status）；MCP Server；Web UI Dashboard；自动上下文检测 |
| **v1.0.0** | 7 个 Skill；6 个平台（Cursor/Copilot/Cline/灵码/CodeBuddy）；CLI install/list |

---

## License

MIT © [aokiz](https://github.com/aokiz-ek)
