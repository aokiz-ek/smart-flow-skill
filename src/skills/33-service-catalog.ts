import type { SkillDefinition } from './types';

export const serviceCatalogSkill: SkillDefinition = {
  id: 'service-catalog',
  name: '服务目录管理',
  nameEn: 'service_catalog',
  order: 33,
  description: '建立标准化服务目录，生成 Backstage 兼容的 catalog-info.yaml，可视化服务依赖与健康评分',
  descriptionEn: 'Build standardized service catalog, generate Backstage-compatible catalog-info.yaml, visualize service dependencies and health scores',
  detailDescription: `在微服务架构中，服务蔓延（Service Sprawl）让工程师不知道"谁拥有哪个服务"。
本 Skill 帮助团队建立标准化的服务目录：采集服务元数据、生成 Backstage/IDP 兼容的 catalog-info.yaml、
绘制服务依赖关系图、建立服务健康评分体系，
让每个工程师都能快速找到服务的 Owner、SLA、依赖关系和运行状态。`,
  triggers: [
    '服务目录',
    'service catalog',
    'service registry',
    'backstage',
    '内部开发者平台',
    'idp',
    '服务注册',
    '@ethan service-catalog',
    '/service-catalog',
  ],
  steps: [
    {
      title: '1. 服务元数据采集',
      content: `系统化收集每个服务的关键元数据：

**服务元数据清单**

\`\`\`yaml
# 必填字段
name:          服务唯一标识（小写 + 连字符）
display_name:  人类可读名称
owner:         团队/个人（GitHub Team 或 email）
tech_stack:    主要技术栈（Node.js/Go/Java 等）
type:          服务类型（service/library/website/pipeline）

# 运维信息
tier:          重要性等级（tier-1/tier-2/tier-3）
sla:           可用性目标（99.9%/99.95%/99.99%）
on_call:       值班联系方式（PagerDuty/Slack channel）
runbook:       运维手册 URL

# 依赖关系
dependencies:  依赖的其他服务列表
consumers:     消费本服务的上游列表
databases:     使用的数据库（类型 + 库名）
external_apis: 调用的外部 API（如 Stripe/SendGrid）

# 文档与质量
docs:          文档链接（Confluence/Notion）
api_spec:      OpenAPI/AsyncAPI 规范文件路径
test_coverage: 当前测试覆盖率
deployment_frequency: 发布频率（daily/weekly/monthly）
\`\`\`

**批量采集脚本**
\`\`\`bash
#!/bin/bash
# 扫描所有服务目录，检查是否有 catalog-info.yaml
for dir in services/*/; do
  if [ ! -f "$dir/catalog-info.yaml" ]; then
    echo "❌ Missing: $dir/catalog-info.yaml"
  else
    echo "✅ Found:   $dir/catalog-info.yaml"
  fi
done
\`\`\`

**输出**：服务元数据采集表（所有服务 + 完整度评分）`,
    },
    {
      title: '2. 生成 catalog-info.yaml',
      content: `生成 Backstage/内部开发者平台兼容的服务定义文件：

**完整 catalog-info.yaml 模板**
\`\`\`yaml
# services/order-service/catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: order-service
  title: 订单服务
  description: 处理订单创建、支付和履约的核心服务
  tags:
    - nodejs
    - postgresql
    - kafka
    - tier-1
  annotations:
    # GitHub 集成
    github.com/project-slug: myorg/order-service
    # 监控集成
    prometheus.io/alert: 'order-service-alerts'
    grafana.com/dashboard: 'https://grafana.internal/d/orders'
    # 文档
    backstage.io/techdocs-ref: dir:.
    # PagerDuty
    pagerduty.com/service-id: P123456
  links:
    - url: https://runbook.internal/order-service
      title: Runbook
      icon: book
    - url: https://grafana.internal/d/orders
      title: Dashboard
      icon: dashboard

spec:
  type: service
  lifecycle: production        # experimental | production | deprecated
  owner: group:backend-team
  system: ecommerce-platform

  # 依赖声明
  dependsOn:
    - component:user-service
    - component:inventory-service
    - resource:orders-postgres
    - resource:payment-kafka-topic

  # 对外提供的 API
  providesApis:
    - order-api-v2
\`\`\`

**API 定义（关联）**
\`\`\`yaml
# order-api.yaml
apiVersion: backstage.io/v1alpha1
kind: API
metadata:
  name: order-api-v2
  description: 订单服务 REST API v2
spec:
  type: openapi
  lifecycle: production
  owner: group:backend-team
  definition:
    $text: ./openapi/order-api-v2.yaml
\`\`\`

**Resource 定义（数据库/队列）**
\`\`\`yaml
apiVersion: backstage.io/v1alpha1
kind: Resource
metadata:
  name: orders-postgres
  description: 订单主数据库（PostgreSQL 14）
spec:
  type: database
  owner: group:dba-team
  system: ecommerce-platform
\`\`\`

**输出**：catalog-info.yaml + API 定义文件 + Resource 定义文件`,
    },
    {
      title: '3. 服务依赖关系图',
      content: `可视化服务间的上下游依赖关系：

**Mermaid 依赖图生成**
\`\`\`typescript
// scripts/gen-dependency-graph.ts
function generateMermaid(services: Service[]): string {
  const lines = ['graph LR'];

  for (const service of services) {
    for (const dep of service.dependencies) {
      lines.push(\`  \${service.name} --> \${dep}\`);
    }
  }

  return lines.join('\\n');
}

// 输出示例：
// graph LR
//   order-service --> user-service
//   order-service --> inventory-service
//   order-service --> payment-service
//   api-gateway --> order-service
//   api-gateway --> user-service
\`\`\`

**关键依赖分析**
\`\`\`
依赖分析报告
════════════

高扇入服务（被依赖最多，故障影响最广）：
  user-service        被 8 个服务依赖  ⚠️ 单点风险
  auth-service        被 12 个服务依赖 🔴 关键路径

高扇出服务（依赖最多，级联失败风险）：
  order-service       依赖 6 个服务    ⚠️ 需熔断保护
  report-service      依赖 9 个服务    🔴 脆弱性高

循环依赖检测：
  ✅ 未发现循环依赖

孤立服务（无依赖/无被依赖）：
  legacy-batch-job    ⚠️ 是否可下线？
\`\`\`

**依赖健康度 Checklist**
- [ ] 高扇入服务（>5个依赖）配备了熔断器（Circuit Breaker）
- [ ] 高扇出服务对所有依赖设置了超时（Timeout）
- [ ] 关键路径服务有冗余/多活部署
- [ ] 无循环依赖

**输出**：服务依赖关系图（Mermaid/DOT）+ 风险分析报告`,
    },
    {
      title: '4. 服务健康评分',
      content: `建立多维度服务健康评分体系，量化技术质量：

**服务健康评分卡（满分 100）**

\`\`\`
维度              权重   评分标准
─────────────────────────────────────────
📄 文档完整性      20分
  catalog-info.yaml    5分  （存在且完整）
  README.md            5分  （含部署、接口说明）
  API 规范             5分  （OpenAPI/AsyncAPI）
  Runbook              5分  （含常见故障处理）

🧪 测试质量        25分
  单元测试覆盖率 >80%  15分
  集成测试存在         10分

🚀 部署规范        25分
  CI/CD 流水线完整     10分
  容器化（Dockerfile） 5分
  健康检查接口         5分
  优雅关闭实现         5分

📊 可观测性        20分
  Metrics 暴露         8分  （/metrics endpoint）
  结构化日志           7分  （JSON 格式 + trace ID）
  告警规则配置         5分

🔒 安全合规        10分
  依赖漏洞扫描通过     5分  （npm audit/Snyk 0 High）
  密钥未硬编码         5分
\`\`\`

**评分等级**
- 🟢 **优秀（90-100）**：可作为黄金路径参考
- 🟡 **良好（70-89）**：有改进空间，下季度计划
- 🟠 **待改进（50-69）**：需要专项提升
- 🔴 **高风险（< 50）**：必须立即改进

**批量评分脚本示例**
\`\`\`bash
#!/bin/bash
# 检查服务健康评分关键项
check_service() {
  local dir=$1
  local score=0

  [ -f "$dir/catalog-info.yaml" ] && score=$((score+5))
  [ -f "$dir/README.md" ] && score=$((score+5))
  [ -f "$dir/Dockerfile" ] && score=$((score+5))
  [ -f "$dir/.github/workflows/ci.yml" ] && score=$((score+10))

  echo "$dir: $score / 25 (快速检查)"
}

for dir in services/*/; do check_service "$dir"; done
\`\`\`

**输出**：服务健康评分卡 + 改进优先级清单`,
    },
    {
      title: '5. 服务生命周期管理',
      content: `建立服务从孵化到下线的标准生命周期流程：

**四阶段生命周期**
\`\`\`
孵化（Experimental）→ 成熟（Production）→ 维护（Maintenance）→ 下线（Deprecated）
\`\`\`

**各阶段定义与要求**

| 阶段 | lifecycle 值 | 要求 | 颜色标记 |
|------|-------------|------|---------|
| 孵化 | experimental | 开发中，不可用于生产 | 🟡 |
| 成熟 | production | 满足健康评分 ≥ 80 | 🟢 |
| 维护 | maintenance | 仅修复 Bug，不加新功能 | 🟠 |
| 下线 | deprecated | 已有替代服务，设定截止日 | 🔴 |

**服务下线流程**
\`\`\`
Day 0:  更新 lifecycle: deprecated，添加 deprecation notice
        通知所有已知消费者（来自 catalog 的 consumers 列表）

Day 30: 确认所有消费者已迁移
        关闭新注册/新依赖

Day 60: 停止接受新请求（返回 410 Gone）
        保留 Read-only 访问用于历史数据查询

Day 90: 完全下线，数据归档
        从 catalog 中标记 archived: true
\`\`\`

**服务晋升 Checklist（Experimental → Production）**
- [ ] 服务健康评分 ≥ 80
- [ ] 通过 Load Test（目标 TPS 的 150% 压力）
- [ ] 完成安全扫描（0 个 High/Critical 漏洞）
- [ ] Runbook 已编写并通过演练
- [ ] 监控告警已配置并验证（OnCall 团队确认）
- [ ] 至少经过 2 周 Canary 发布观察

**输出**：服务生命周期文档 + 下线流程 + 晋升 Checklist`,
    },
  ],
  outputFormat: 'catalog-info.yaml 文件 + 服务依赖关系图（Mermaid）+ 服务健康评分卡 + 生命周期管理规范',
  examples: [],
  notes: [
    '服务目录的价值在于"被发现"——确保 catalog-info.yaml 提交到代码库并与 Backstage/IDP 自动同步',
    '从高 Tier（Tier-1 核心服务）开始建立目录，而非试图一次性覆盖所有服务',
    '服务健康评分应作为季度技术评审的固定议题，驱动持续改进',
    '依赖关系图定期更新至关重要——过时的依赖图比没有图更危险',
    'Backstage 是目前最成熟的开源 IDP，推荐中大型团队直接采用；小团队可用 catalog-info.yaml 文件 + 简单脚本代替',
  ],
  category: '执行侧',
  nextSkill: 'deployment',
};
