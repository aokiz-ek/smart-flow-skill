import type { SkillDefinition } from './types';

export const gitWorkflowSkill: SkillDefinition = {
  id: 'git-workflow',
  name: 'Git 工作流',
  nameEn: 'git_workflow',
  order: 15,
  category: '执行侧',
  description: '规范 Git 分支策略、提交规范、合并流程，建立团队一致的版本控制工作流',
  descriptionEn: 'Establish consistent Git branching strategy, commit conventions, and merge workflow for teams',
  detailDescription: `系统梳理 Git 工作流全流程，涵盖 GitFlow/Trunk-Based 分支策略选型、Conventional Commits 提交规范、
rebase vs merge 决策、冲突解决流程和 PR/MR 最佳实践，帮助团队建立高效、可追溯的版本控制体系。`,
  triggers: [
    'Git 工作流',
    'git workflow',
    'git 规范',
    '分支策略',
    'branching strategy',
    'commit 规范',
    'commit convention',
    '提交规范',
    'PR 规范',
    'rebase vs merge',
    '冲突解决',
    '@ethan git',
    '@ethan git-workflow',
  ],
  steps: [
    {
      title: '1. 评估项目特征，选择分支策略',
      content: `根据团队规模和发布节奏选择合适的分支策略：

**GitFlow 适用场景**
- 有明确版本号的产品（如 App、SDK、开源库）
- 需要维护多个线上版本
- 发布周期较长（周/月级别）

\`\`\`
main          ──●────────────────────●──  (生产稳定)
hotfix/1.0.1    └──●──┘                  (紧急修复)
release/1.1       └──●──┘               (预发布验证)
develop       ──●──────●──────●──────●── (集成分支)
feature/login    └──●──┘                 (功能开发)
\`\`\`

**Trunk-Based Development 适用场景**
- 持续部署（CD）体系成熟
- 有完善的 Feature Flag 机制
- 团队规模适中（≤50 人），发布频率高（日/周）

\`\`\`
main  ──●──●──●──●──●──  (直接推送或短命分支 <2天)
feat   └──●──┘           (短命功能分支，快速合并)
\`\`\`

**决策矩阵**

| 维度 | GitFlow | Trunk-Based |
|------|---------|-------------|
| 发布频率 | 低（周/月） | 高（日/周） |
| 团队规模 | 大 | 中小 |
| 多版本维护 | 支持 | 不擅长 |
| CI/CD 成熟度 | 低要求 | 高要求 |`,
    },
    {
      title: '2. 制定提交信息规范（Conventional Commits）',
      content: `采用 Conventional Commits 规范，格式：\`<type>(<scope>): <subject>\`

**类型（type）定义**

| type | 用途 | 版本影响 |
|------|------|---------|
| \`feat\` | 新功能 | MINOR |
| \`fix\` | Bug 修复 | PATCH |
| \`perf\` | 性能优化 | PATCH |
| \`refactor\` | 重构（无功能变化） | — |
| \`docs\` | 文档变更 | — |
| \`test\` | 测试相关 | — |
| \`chore\` | 构建/依赖/工具 | — |
| \`ci\` | CI 配置变更 | — |
| \`BREAKING CHANGE\` | 破坏性变更（Footer） | MAJOR |

**示例**
\`\`\`bash
# 好的提交信息
feat(auth): add OAuth2 login with Google provider
fix(cart): prevent duplicate item addition on rapid click
perf(query): add composite index on (user_id, created_at)
refactor(api): extract pagination helper to shared utils
docs(readme): update installation steps for Node 20

# 破坏性变更写法
feat(api)!: rename /users endpoint to /accounts

BREAKING CHANGE: /users endpoint removed, use /accounts instead
\`\`\`

**工具链配置**
\`\`\`bash
# 安装 commitlint
npm install -D @commitlint/cli @commitlint/config-conventional
echo "module.exports = {extends: ['@commitlint/config-conventional']}" > commitlint.config.js

# 配合 husky 在 commit-msg 钩子校验
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit $1'
\`\`\``,
    },
    {
      title: '3. Rebase vs Merge 决策与实践',
      content: `**核心原则：黄金法则 — 不要 rebase 已推送的公共分支**

**何时用 Merge**
- 合并长期分支（feature → develop）
- 需要保留完整历史记录（审计场景）
- 多人协作的共享分支

\`\`\`bash
# 保留合并记录（推荐用于 PR/MR 合并）
git merge --no-ff feature/login

# 快进合并（适合独立小修改）
git merge --ff-only hotfix/typo
\`\`\`

**何时用 Rebase**
- 更新本地功能分支，与主干保持同步
- 整理本地提交历史，推送 PR 前清理

\`\`\`bash
# 将功能分支变基到最新 main
git checkout feature/login
git rebase origin/main

# 交互式 rebase：合并/重排/修改最近 3 个提交
git rebase -i HEAD~3
# 选项: pick / squash(s) / fixup(f) / reword(r) / drop(d)
\`\`\`

**Squash Merge**（GitHub/GitLab PR 推荐）
\`\`\`bash
# 将功能分支所有提交合并为一个干净提交
git merge --squash feature/login
git commit -m "feat(auth): add login page with form validation"
\`\`\`

**推荐工作流**
1. 本地开发：随意提交，保持节奏
2. 推送 PR 前：\`git rebase -i origin/main\` 整理提交
3. PR 合并：使用 Squash Merge 保持主干干净`,
    },
    {
      title: '4. 冲突解决流程',
      content: `**结构化冲突解决步骤**

\`\`\`bash
# Step 1: 理解冲突来源
git log --oneline --graph --all  # 查看分支关系
git diff HEAD origin/main        # 对比差异

# Step 2: 标记冲突文件分析
git status  # 查看所有冲突文件
# conflict markers: <<<<<<< HEAD ... ======= ... >>>>>>> branch

# Step 3: 使用工具辅助解决
git mergetool  # 调用配置的 merge tool（VSCode / IntelliJ）

# 配置 VSCode 为默认 merge tool
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
\`\`\`

**三路合并理解（Three-way merge）**
\`\`\`
BASE（公共祖先）：const timeout = 5000;
OURS（当前分支）：const timeout = 10000;  // 改为10s
THEIRS（被合并）：const TIMEOUT = 5000;   // 改为大写常量名
RESULT（手动）：  const TIMEOUT = 10000;  // 两个改动都要
\`\`\`

**预防冲突的最佳实践**
- 功能分支生命周期控制在 1-3 天内
- 每日同步主干：\`git pull --rebase origin main\`
- 大文件/自动生成文件加入 \`.gitattributes\` 配置合并策略
\`\`\`gitattributes
# 始终使用 ours 策略合并 lock 文件（减少冲突）
package-lock.json merge=ours
yarn.lock merge=ours
\`\`\``,
    },
    {
      title: '5. Pull Request / Code Review 流程规范',
      content: `**PR 模板设计**
\`\`\`markdown
## 变更说明
[简洁描述本次变更做了什么、为什么]

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 性能优化 (perf)

## 测试验证
- [ ] 单元测试通过
- [ ] 手动测试场景: [描述]
- [ ] 截图/录屏（UI 变更必填）

## 影响范围
[描述可能影响的模块或依赖方]

## Checklist
- [ ] 代码自查完毕
- [ ] 无调试代码 (console.log/debugger)
- [ ] 文档已更新（如需要）
\`\`\`

**PR 规模控制**
- 理想 PR 大小：< 400 行（不含测试）
- 超过 800 行：强制拆分为多个 PR
- 可用 \`git diff --stat origin/main\` 提前检查

**分支保护规则（GitHub/GitLab 配置）**
\`\`\`
main 分支保护：
✅ Require pull request reviews (min: 1)
✅ Require status checks to pass (CI/lint/test)
✅ Require branches to be up to date
✅ Restrict push access (仅管理员)
✅ Require signed commits（高安全场景）
\`\`\``,
    },
    {
      title: '6. 输出工作流规范文档',
      content: `整理为团队可直接使用的规范文档，格式如下：

\`\`\`markdown
## Git 工作流规范

### 分支命名
- feature/<ticket-id>-short-description  (如: feature/PROJ-123-user-login)
- fix/<ticket-id>-short-description
- hotfix/<version>-short-description     (如: hotfix/1.2.1-payment-crash)
- release/<version>                      (如: release/1.3.0)

### 提交规范
格式: <type>(<scope>): <subject>
示例: feat(auth): add JWT refresh token support

### 禁止行为
❌ 直接推送到 main/master
❌ force push 到共享分支
❌ rebase 已推送的公共分支
❌ 超过 1000 行的单次 PR（紧急 hotfix 除外）

### 分支生命周期
- feature 分支: ≤ 5 个工作日
- release 分支: ≤ 2 周
- hotfix 分支: ≤ 24 小时
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 工作流规范文档，含分支策略选型建议、提交规范示例、rebase/merge 决策指南、冲突解决 SOP 和 PR 规范模板',
  examples: [
    {
      input: '我们团队5人，做 SaaS 产品，每周发版一次，应该用什么 Git 工作流？',
      output: `## Git 工作流建议：GitHub Flow（简化 GitFlow）

**推荐理由**：5人小团队 + 每周发版，GitHub Flow 复杂度适中，无需维护多个长期分支。

**分支结构**
- \`main\`：始终可部署，受保护
- \`feature/xxx\`：功能开发，完成即 PR，合并即删除

**提交规范**：Conventional Commits
**合并策略**：Squash Merge（保持 main 历史干净）
**发版标记**：\`git tag v1.x.0\` 打标签`,
    },
  ],
  notes: [
    '分支策略没有银弹，根据团队规模和发版频率选择最适合的',
    'force push 操作必须在团队内公告，避免其他成员本地分支混乱',
    '建议在 CI 中自动校验 commit message 格式，而非依赖人工审查',
    '冲突解决后务必运行测试，确保合并结果功能正常',
  ],
  nextSkill: 'unit-testing',
};
