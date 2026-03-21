# Ethan

**Ethan - Your AI Workflow Assistant**

将 10 个标准化工作流节点打包为可跨平台分发的 AI Skill，支持 11 个主流 AI 编辑器/IDE，让每一步都有据可依。

🌐 **官网**：[aokiz-ek.github.io/smart-flow-skill](https://aokiz-ek.github.io/smart-flow-skill/)

---

## 功能概览

### 10 个 Skill

| # | Skill | 分类 | 触发词（示例） | 说明 |
|---|-------|------|--------------|------|
| 1 | 需求理解 | 需求侧 | `需求理解`、`分析需求`、`@ethan 需求` | 深度解析需求，消除歧义，输出结构化需求文档 |
| 2 | 任务拆解 | 需求侧 | `任务拆解`、`拆解任务`、`@ethan 拆解` | 将需求拆解为原子任务，建立依赖关系 |
| 3 | 方案设计 | 执行侧 | `方案设计`、`技术方案`、`@ethan 设计` | 输出架构设计、接口设计、数据模型 |
| 4 | 执行实现 | 执行侧 | `执行实现`、`开始实现`、`@ethan 实现` | 按设计方案逐步实现，含代码自检清单 |
| 5 | 进度跟踪 | 跟踪侧 | `进度跟踪`、`进度更新`、`@ethan 进度` | 实时更新任务状态，识别阻塞风险 |
| 6 | 任务报告 | 输出侧 | `任务报告`、`生成报告`、`@ethan 报告` | 生成成果报告含问题复盘和经验教训 |
| 7 | 周报生成 | 输出侧 | `周报`、`生成周报`、`@ethan 周报` | 自动生成结构化周报，突出业务价值 |
| 8 | 代码审查 | 质量侧 | `代码审查`、`code review`、`CR` | 系统性审查，分级输出 Blocker/Major/Minor |
| 9 | 故障排查 | 质量侧 | `故障排查`、`debug`、`线上故障` | 假设验证 + 5 Why 根因分析，三层解决方案 |
| 10 | 技术调研 | 需求侧 | `技术调研`、`技术选型`、`POC` | 加权评分矩阵 + POC 验证，输出有据可查的结论 |

### 3 个 Pipeline（链式工作流）

| Pipeline | Skills | 适用场景 |
|----------|--------|---------|
| `dev-workflow` | 需求理解 → 任务拆解 → 方案设计 → 执行实现 | 完整功能开发 |
| `reporting` | 进度跟踪 → 任务报告 → 周报生成 | 项目汇报 |
| `quality-workflow` | 代码审查 → 故障排查 | 质量保障 |

---

## 安装

### 一键安装（CLI）

```bash
# 安装到当前项目（所有平台）
npx ethan-skill install --platform all

# 安装到指定平台
npx ethan-skill install --platform cursor
npx ethan-skill install --platform copilot
npx ethan-skill install --platform windsurf
# ... 其他平台见下表
```

### 支持的 11 个平台

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

### MCP Server

在 MCP 客户端配置文件（如 `~/.cursor/mcp.json`）中添加：

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

重启 AI 编辑器后，可使用 10 个独立 Skill tool + 1 个 Pipeline tool（`ethan_pipeline`）。

### VS Code 扩展

1. 下载 `dist/ethan-skill-*.vsix`
2. VS Code → Extensions → `...` → Install from VSIX
3. 在 Copilot Chat 中输入 `@ethan /需求理解 <你的需求>`

---

## CLI 命令

```bash
# 安装规则文件到当前项目
npx ethan-skill install --platform all

# 列出所有 Skill（带分类信息）
npx ethan-skill list
npx ethan-skill list --json

# Pipeline 管理
npx ethan-skill pipeline list
npx ethan-skill pipeline run dev-workflow -c "开发用户登录功能"

# 验证 rules/ 与 src/skills/ 是否同步
npx ethan-skill validate

# 环境与文件健康检查
npx ethan-skill doctor

# 使用频次统计
npx ethan-skill stats
npx ethan-skill stats --reset

# 启动 MCP Server
npx ethan-skill mcp
```

---

## 开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build          # 编译 TypeScript → dist/
npm run build:rules    # 生成 11 个平台规则文件（rules/ 目录）
npm run build:all      # 全量构建（build + build:rules）
npm run dev            # 监视模式编译
```

### 代码质量

```bash
npm run lint           # ESLint 检查
npm run lint:fix       # ESLint 自动修复
npm run format         # Prettier 格式化
npm run format:check   # Prettier 格式校验
```

### 测试

```bash
npm test               # 运行所有测试（Vitest，66 个测试用例）
npm run test:watch     # 监视模式
npm run test:coverage  # 生成覆盖率报告
```

测试覆盖范围：
- **Skills 契约**：ALL_SKILLS 唯一性、步骤完整性、nextSkill 有效性
- **Pipeline**：resolvePipeline 正确解析，skillIds 引用合法
- **触发词路由**：精确/模糊/大小写/空串/trim 场景
- **模板渲染**：11 个平台 × 输出正确性

### 修改 Skill 内容

1. 编辑 `src/skills/0X-skill-name.ts`
2. 运行 `npm run build:rules` 重新生成规则文件
3. 运行 `npm test` 确认测试通过
4. 提交 `src/` 和 `rules/` 目录变更

### 添加新 Skill

1. 创建 `src/skills/0X-new-skill.ts`，实现 `SkillDefinition` 接口（含 `category`、`nextSkill`）
2. 在 `src/skills/index.ts` 的 `ALL_SKILLS` 数组末尾添加
3. 运行 `npm run build:rules && npm test`

### 添加新平台

1. 在 `src/skills/types.ts` 的 `Platform` 联合类型中添加新值
2. 在 `src/templates/copilot-md.template.ts` 的 `switch` 中添加对应 `case`（无 default，TypeScript 强制穷举）
3. 在 `scripts/build/build-rules.ts` 中添加 `writeFile` 调用
4. 在 `src/cli/index.ts` 的 `platformMap` 中添加安装路径

---

## 架构设计

### 单一数据源（Single Source of Truth）

```
src/skills/*.ts  →  [build-rules.ts]  →  rules/cursor/smart-flow.mdc
                                      →  rules/cursor/.cursorrules
                                      →  rules/copilot/copilot-instructions.md
                                      →  rules/cline/.clinerules
                                      →  rules/lingma/smart-flow.md
                                      →  rules/codebuddy/CODEBUDDY.md
                                      →  rules/windsurf/.windsurf/rules/smart-flow.md
                                      →  rules/zed/smart-flow.rules
                                      →  rules/jetbrains/smart-flow.md
                                      →  rules/continue/.continuerules
                                      →  rules/claude-code/CLAUDE.md
```

所有内容存放在 TypeScript 源文件，构建时生成各平台文件，避免多处同步。`rules/` 目录提交到仓库供直接使用。

### 目录结构

```
ethan-skill/
├── src/
│   ├── skills/          # 单一数据源（10 个 Skill + pipeline 定义）
│   │   ├── types.ts     # SkillDefinition、Platform、PipelineDefinition 接口
│   │   ├── index.ts     # ALL_SKILLS 导出入口
│   │   ├── pipeline.ts  # PIPELINES + resolvePipeline()
│   │   └── 01~10-*.ts   # 各 Skill 定义
│   ├── router/          # 触发词路由（routeTrigger）
│   ├── templates/       # 各平台渲染模板
│   ├── cli/             # CLI 入口（install/list/validate/pipeline/doctor/stats/mcp）
│   ├── vscode/          # VS Code 扩展
│   └── mcp/             # MCP Server（含 ethan_pipeline tool）
├── rules/               # 构建产物，11 个平台（提交到仓库）
├── docs/                # 官网（GitHub Pages）
├── scripts/build/       # 构建脚本
└── vscode-extension/    # VS Code 扩展 manifest
```

---

## 版本管理

使用 [Changesets](https://github.com/changesets/changesets) 管理版本：

```bash
npx changeset          # 添加变更记录
npx changeset version  # 升版本号
npm run build:all
npm publish
```

---

## License

MIT
