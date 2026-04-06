import type { SkillDefinition } from './types';

export const techDebtSkill: SkillDefinition = {
  id: 'tech-debt',
  name: '技术债追踪',
  nameEn: 'tech_debt',
  order: 27,
  description: '识别、量化、排序技术债，生成偿还路线图与预防机制',
  descriptionEn: 'Identify, quantify and prioritize technical debt, generate repayment roadmap and prevention mechanisms',
  detailDescription: `技术债如同金融债务，越早偿还利息越低。
本 Skill 帮助团队系统化地识别代码库中的技术债（TODO/FIXME 聚集、高圈复杂度、重复代码、高耦合模块），
通过"影响 × 修复成本"矩阵量化优先级，生成可落地的 Sprint 偿还计划，
并建立长效预防机制，让技术债不再悄悄累积。`,
  triggers: [
    '技术债',
    'tech debt',
    'technical debt',
    '技术债追踪',
    '技术债偿还',
    'code smell',
    '代码腐化',
    '@ethan tech-debt',
    '/tech-debt',
  ],
  steps: [
    {
      title: '1. 技术债识别与分类',
      content: `扫描代码库，从以下维度识别技术债：

**四大技术债类型**

| 类型 | 检测手段 | 典型表现 |
|------|---------|---------|
| **代码债** | TODO/FIXME/HACK 注释统计 | 注释标记超过 50 个/千行 |
| **设计债** | 圈复杂度 > 10，类长度 > 500 行 | 上帝类、面条代码、深层继承 |
| **测试债** | 覆盖率 < 60%，测试缺失模块 | 核心模块无测试，回归靠手工 |
| **依赖债** | 过时依赖、已弃用 API 调用 | 主版本落后 2+ 个版本 |

**识别命令参考**
\`\`\`bash
# 统计 TODO/FIXME
grep -rn "TODO\\|FIXME\\|HACK\\|XXX" src/ --include="*.ts" | wc -l

# 查找超长文件
find src -name "*.ts" | xargs wc -l | sort -rn | head -20

# 重复代码检测（需安装 jscpd）
npx jscpd src/ --min-lines 5 --reporters json
\`\`\`

**输出**：技术债清单（分类 + 位置 + 初步评估）`,
    },
    {
      title: '2. 债务量化评估',
      content: `用"影响度 × 修复成本"矩阵评估每项技术债的优先级：

**评分维度**

| 维度 | 1分（低） | 3分（中） | 5分（高） |
|------|---------|---------|---------|
| **业务影响** | 边缘功能 | 常用功能 | 核心链路 |
| **出错频率** | 极少触发 | 偶尔出现 | 频繁发生 |
| **修复成本** | < 0.5天 | 0.5~2天 | > 2天 |
| **扩散风险** | 独立模块 | 少量依赖 | 多处依赖 |

**优先级 = 影响度（业务影响 × 出错频率） ÷ 修复成本**

**T恤 Size 对照**
- 🔴 **Critical（>8分）**：阻碍新功能开发，必须本 Sprint 处理
- 🟠 **High（5-8分）**：影响团队效率，下个 Sprint 安排
- 🟡 **Medium（3-5分）**：纳入季度技术改进计划
- 🟢 **Low（<3分）**：有时间再处理，记录即可

**输出**：技术债优先级矩阵（标注 T恤 Size）`,
    },
    {
      title: '3. 偿还路线图',
      content: `按"高影响、低成本"优先原则，制定可落地的偿还计划：

**Sprint 规划原则**
- 每个 Sprint 分配 **15-20% 时间**用于技术债偿还（债务预算）
- Critical 债务：独立 Story，本 Sprint 必须完成
- High 债务：与新功能并行，2 个 Sprint 内完成
- Medium 债务：季度 Hackathon 集中处理

**路线图模板**
\`\`\`
Sprint N（当前）
  🔴 [Critical] 拆分 UserService 上帝类 → 3个子服务    2天
  🔴 [Critical] 修复登录模块 XXX 标记的并发 Bug         1天

Sprint N+1
  🟠 [High] 提升 Payment 模块测试覆盖率至 80%          2天
  🟠 [High] 替换废弃的 axios v0.21 → v1.x              1天

Q+1 季度计划
  🟡 [Medium] 重构订单模块（圈复杂度>15的5个函数）      5天
  🟡 [Medium] 清理 87 个 TODO 注释并创建对应 Issue     3天
\`\`\`

**输出**：按 Sprint 排期的技术债偿还路线图`,
    },
    {
      title: '4. 预防机制',
      content: `建立长效机制，让技术债不再悄悄累积：

**自动化门禁（CI/CD 集成）**
\`\`\`yaml
# .github/workflows/debt-check.yml
- name: 技术债扫描
  run: |
    # TODO 数量检查
    TODO_COUNT=$(grep -rn "TODO\\|FIXME" src/ | wc -l)
    if [ $TODO_COUNT -gt $TODO_THRESHOLD ]; then
      echo "❌ TODO 数量超过阈值: $TODO_COUNT > $TODO_THRESHOLD"
      exit 1
    fi
    # 圈复杂度检查（使用 complexity-report 或 ESLint）
    npx eslint src/ --rule '{"complexity": ["error", 10]}'
\`\`\`

**团队规范**
- **Boy Scout 原则**：离开时让代码比你来时更干净（每次 PR 消灭 1 个技术债）
- **TODO 转 Issue**：所有 TODO 必须关联 GitHub Issue，不得孤立存在
- **债务预算制度**：每个 Sprint 强制预留 15% 时间偿还债务
- **月度债务评审**：每月 Review 技术债清单，更新优先级

**技术债仪表盘指标**
- TODO/FIXME 总数趋势（目标：每月下降 10%）
- 平均圈复杂度（目标：< 8）
- 测试覆盖率（目标：> 80%）
- 依赖过时率（目标：0 个 Critical 漏洞）

**输出**：CI 门禁配置 + 团队规范文档 + 仪表盘指标定义`,
    },
  ],
  outputFormat: '技术债地图（分级清单）+ 优先级矩阵（影响×成本）+ Sprint 偿还路线图 + CI 门禁配置 + 预防规范',
  examples: [],
  notes: [
    '技术债不是"坏代码"，是在特定时间压力下做出的有意识权衡，关键是要记录并计划偿还',
    '建议在项目初期就建立债务预算制度（15-20% Sprint 时间），而不是等到债务失控再处理',
    '优先处理"高影响低成本"的债务，避免在低价值债务上耗费资源',
    '技术债清单应纳入项目文档，让所有成员可见，避免只有架构师知道',
  ],
  category: '质量侧',
  nextSkill: 'refactoring',
};
