# Ethan

Ethan - Your AI Workflow Assistant

将 7 个标准化工作流节点打包为可跨平台分发的 AI Skill，支持 Cursor、VS Code Copilot、Cline、通义灵码、腾讯 CodeBuddy。

## 功能概览

| Skill | 触发词 | 说明 |
|-------|--------|------|
| 需求理解 | `需求理解`、`分析需求` | 深度解析需求，消除歧义，输出结构化需求文档 |
| 任务拆解 | `任务拆解`、`拆解任务` | 将需求拆解为原子任务，建立依赖关系 |
| 方案设计 | `方案设计`、`技术方案` | 输出架构设计、接口设计、数据模型 |
| 执行实现 | `执行实现`、`开始实现` | 按设计方案逐步实现，含代码自检清单 |
| 进度跟踪 | `进度跟踪`、`进度更新` | 实时更新任务状态，识别阻塞风险 |
| 任务报告 | `任务报告`、`生成报告` | 生成成果报告含问题复盘和经验教训 |
| 周报生成 | `周报`、`生成周报` | 自动生成结构化周报，突出业务价值 |

---

## 安装方式

### 方式一：Cursor（推荐）

**新版 Cursor（.mdc）：**
```bash
# 复制规则文件到项目
cp rules/cursor/smart-flow.mdc .cursor/rules/smart-flow.mdc
```

**旧版 Cursor：**
```bash
cp rules/cursor/.cursorrules .cursorrules
```

**或使用 CLI 一键安装：**
```bash
npx ethan-skill install --platform cursor
```

---

### 方式二：VS Code Copilot

```bash
mkdir -p .github
cp rules/copilot/copilot-instructions.md .github/copilot-instructions.md
```

或 CLI：
```bash
npx ethan-skill install --platform copilot
```

---

### 方式三：Cline

```bash
cp rules/cline/.clinerules .clinerules
```

---

### 方式四：通义灵码（Lingma）

```bash
mkdir -p .lingma/rules
cp rules/lingma/smart-flow.md .lingma/rules/smart-flow.md
```

---

### 方式五：腾讯 CodeBuddy

```bash
cp rules/codebuddy/CODEBUDDY.md CODEBUDDY.md
```

---

### 方式六：安装所有平台

```bash
npx ethan-skill install --platform all
```

---

### 方式七：VS Code 扩展

1. 下载 `dist/ethan-skill-*.vsix`
2. VS Code → Extensions → `...` → Install from VSIX
3. 在 Copilot Chat 中输入 `@ethan /需求理解 <你的需求>`

---

### 方式八：MCP Server

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

重启 AI 编辑器后，可使用 7 个 MCP tools：
- `requirement_understanding`
- `task_breakdown`
- `solution_design`
- `implementation`
- `progress_tracking`
- `task_report`
- `weekly_report`

---

## CLI 使用

```bash
# 安装规则文件
npx ethan-skill install --platform all

# 列出所有 Skill
npx ethan-skill list

# 以 JSON 格式输出
npx ethan-skill list --json

# 启动 MCP Server
npx ethan-skill mcp
```

---

## 开发

### 前提

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 构建

```bash
# 编译 TypeScript
npm run build

# 生成所有平台规则文件（rules/ 目录）
npm run build:rules

# 打包 VS Code 扩展
npm run build:vscode

# 全量构建
npm run build:all
```

### 修改 Skill 内容

1. 编辑 `src/skills/0X-skill-name.ts`
2. 运行 `npm run build:rules` 重新生成规则文件
3. 提交 `rules/` 目录变更（规则文件提交到仓库）

### 添加新 Skill

1. 创建 `src/skills/0X-new-skill.ts`，实现 `SkillDefinition` 接口
2. 在 `src/skills/index.ts` 的 `ALL_SKILLS` 数组中添加
3. 运行 `npm run build:rules`

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
```

所有内容存放在 TypeScript 源文件，构建时生成各平台文件，避免多处同步。

### 目录结构

```
ethan-skill/
├── src/
│   ├── skills/          # 单一数据源（7 个 Skill 定义）
│   ├── router/          # 触发词路由
│   ├── templates/       # 各平台渲染模板
│   ├── cli/             # npx 入口
│   ├── vscode/          # VS Code 扩展
│   └── mcp/             # MCP Server
├── rules/               # 构建产物（提交到仓库）
├── scripts/build/       # 构建脚本
└── vscode-extension/    # VS Code 扩展 manifest
```

---

## 版本管理

使用 [Changesets](https://github.com/changesets/changesets) 管理版本：

```bash
# 添加变更记录
npx changeset

# 发布新版本
npx changeset version
npm run build:all
npm publish
```

---

## License

MIT
