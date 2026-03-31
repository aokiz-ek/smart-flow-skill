import type { SkillDefinition } from './types';

export const deploymentSkill: SkillDefinition = {
  id: 'deployment',
  name: '部署上线',
  nameEn: 'deployment',
  order: 13,
  description: '系统化执行部署上线流程，覆盖预检、发布、验证和回滚，保障变更安全落地',
  descriptionEn: 'Systematic deployment checklist covering pre-flight, release, verification, and rollback procedures',
  detailDescription: `按阶段执行部署上线流程，包括上线前预检（代码质量、配置核查、依赖验证）、
发布执行（灰度/蓝绿/滚动策略）、上线后验证（健康检查、监控告警、业务核心链路验证）
以及回滚方案，确保变更安全可控地落地。`,
  triggers: [
    '部署上线',
    '上线',
    '发布',
    'deploy',
    '发版',
    '部署',
    '上线流程',
    '发布流程',
    '怎么上线',
    '准备上线',
    '@ethan 上线',
    '@ethan deploy',
    '/部署上线',
  ],
  steps: [
    {
      title: '1. 上线前预检（Pre-flight）',
      content: `在发布代码前完成以下检查，任何一项 ❌ 不得上线：

**代码质量**
- [ ] 所有 CI 检查通过（单测、集成测试、Lint）
- [ ] Code Review 已完成，无 Blocker 问题
- [ ] 安全扫描无 Critical/High 级别漏洞（\`npm audit\`）
- [ ] 变更已在 Staging/预生产环境验证通过

**配置核查**
- [ ] 生产环境配置（数据库、Redis、MQ 地址）已更新
- [ ] 环境变量已在目标环境注入（不含硬编码的密钥）
- [ ] Feature Flag 配置正确（灰度开关状态）

**数据库变更**
- [ ] 数据库迁移脚本已备份原表结构
- [ ] 迁移脚本已在 Staging 执行并验证
- [ ] 大表 DDL 变更（加字段/加索引）在低峰期执行，评估锁表时间

**依赖与基础设施**
- [ ] 第三方服务（支付/短信/CDN）已确认可用
- [ ] 新增的 Redis Key / MQ Topic 已提前创建
- [ ] 容器镜像已构建并推送到镜像仓库

**通知**
- [ ] 上线时间已知会相关团队（QA / 前端 / 产品 / 运维）
- [ ] 回滚预案已准备（上个版本的镜像 Tag 或 SQL 回滚脚本）`,
    },
    {
      title: '2. 选择发布策略',
      content: `根据变更风险等级选择合适的发布策略：

**🟢 滚动发布（Rolling Update）**
- 场景：低风险常规迭代
- 方式：逐个 Pod/实例替换，始终保持一定数量可用
- Kubernetes：\`kubectl set image deployment/app app=image:v2\`
- 优点：无停机；缺点：同时存在新旧版本（需兼容）

**🟡 蓝绿部署（Blue/Green）**
- 场景：中风险版本，需要快速回滚能力
- 方式：并行运行两套环境，切换负载均衡流量
- 优点：回滚只需切流量（秒级）；缺点：资源成本翻倍

**🟠 灰度发布（Canary Release）**
- 场景：高风险变更，需验证真实流量
- 方式：先放 5%-10% 流量到新版本，观察监控后逐步扩量
- 关键指标：错误率、P99 延迟、业务转化率
- Nginx 示例：\`split_clients "\${remote_addr}" \$upstream { 10% backend_v2; * backend_v1; }\`

**🔴 停机发布（Maintenance Window）**
- 场景：强破坏性变更（如数据库大规模迁移）
- 提前在状态页通知用户，维护窗口选在凌晨低峰期`,
    },
    {
      title: '3. 执行发布',
      content: `**自动化流水线（推荐）**
\`\`\`bash
# GitOps 方式：更新镜像 Tag 触发 CD
git tag v1.2.3 && git push origin v1.2.3

# 手动触发 GitHub Actions
gh workflow run deploy.yml --field environment=production --field version=v1.2.3
\`\`\`

**发布过程监控要点**
- 实时观察 Pod 滚动状态：\`kubectl rollout status deployment/app\`
- 监控健康检查端点（Liveness/Readiness Probe）
- 观察 APM 工具（Datadog/SkyWalking）中错误率和延迟变化
- 若部署过程中出现 CrashLoopBackOff，立即暂停并触发回滚

**数据库迁移执行顺序**
1. 先执行 向后兼容的迁移（如加字段，设默认值）
2. 发布新代码
3. 确认新代码运行稳定后，再执行清理旧逻辑的迁移
（Expand-Contract 模式，避免新旧代码不兼容）`,
    },
    {
      title: '4. 上线后验证',
      content: `发布完成后，在 **15 分钟内**完成以下验证：

**基础健康检查**
- [ ] 所有实例健康检查端点 \`/health\` 返回 200
- [ ] Pod/实例数量与预期一致（未发生缩减）
- [ ] 无 OOMKilled 或高 CPU 异常

**监控告警**
- [ ] 错误率（5xx）在基线水平（< 0.1%）
- [ ] P99 响应时间未劣化（对比上线前）
- [ ] 关键业务指标（下单量、登录量）趋势正常

**核心链路冒烟测试**
- [ ] 用最高风险的 1-3 个核心功能人工验证
  - 示例：登录 → 查看商品 → 加购 → 提交订单
- [ ] 检查日志无新增 ERROR 级别错误

**灰度扩量（Canary 场景）**
\`\`\`
5% → 稳定 10min → 20% → 稳定 10min → 50% → 100%
\`\`\``,
    },
    {
      title: '5. 回滚方案',
      content: `**触发回滚的条件（满足任一立即回滚）**
- 错误率超过基线 3 倍以上
- P99 延迟超过告警阈值 2 倍
- 核心业务指标断崖式下跌
- 出现 Critical 级别报错

**回滚操作**
\`\`\`bash
# Kubernetes 快速回滚
kubectl rollout undo deployment/app
kubectl rollout undo deployment/app --to-revision=3  # 回滚到指定版本

# Docker Compose 回滚
docker-compose up -d --no-deps --scale app=2  # 拉起旧版本
\`\`\`

**数据库回滚**
- 向后兼容的迁移（加字段）通常不需要回滚
- 破坏性迁移回滚需执行预先准备的 SQL 脚本
- 数据删除操作必须在回滚脚本中用 INSERT 恢复（从备份）

**上线后记录**
- 记录上线时间、版本号、发布人
- 若出现问题，触发故障排查（\`ethan debug\`）和事后复盘（\`ethan oncall\`）`,
    },
  ],
  outputFormat:
    'Markdown 上线 Checklist + 执行记录，含预检清单、发布策略建议、验证结果和回滚记录',
  examples: [
    {
      input: '我要把一个新的支付功能部署到生产环境',
      output: `## 部署上线计划 — 支付功能 v2.1.0

### 风险评估：🟠 高（涉及支付链路）
**推荐策略**：灰度发布（Canary），5% → 20% → 100%

### 预检清单（必须全部 ✅）
- [ ] 支付接口单测覆盖率 > 80%
- [ ] Staging 环境已与支付网关联调通过
- [ ] 数据库迁移脚本已备份 orders 表
- [ ] 已知会支付运营和风控团队

### 灰度时间窗口
5% 灰度 → 观察30min → 扩量至100%

### 核心验证
- 微信支付 / 支付宝 全流程下单`,
    },
  ],
  notes: [
    '生产环境首次部署必须有专人在线值守，完成后才能离开',
    '数据库变更是最高风险项，大表 DDL 操作务必在低峰期执行',
    '回滚方案必须提前验证可用，不能到了出问题才发现回滚脚本有 bug',
    '蓝绿和灰度部署需要基础设施支持，提前确认 K8s/Nginx 配置',
  ],
  category: '执行侧',
};
