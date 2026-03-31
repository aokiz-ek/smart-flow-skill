import type { SkillDefinition } from './types';

export const observabilitySkill: SkillDefinition = {
  id: 'observability',
  name: '可观测性',
  nameEn: 'observability',
  order: 23,
  category: '质量侧',
  description: '建立日志、指标、链路追踪三支柱体系，实现系统状态完全可观测，快速定位生产问题',
  descriptionEn: 'Build the three pillars of observability (logs, metrics, traces) to achieve full system visibility and fast production diagnosis',
  detailDescription: `围绕可观测性三支柱（Logs / Metrics / Traces），指导团队从零建立或完善监控体系，
包括结构化日志规范、Prometheus 指标采集、分布式链路追踪（OpenTelemetry）、告警策略设计和 SLO 定义，
帮助团队在生产故障时快速定位根因。`,
  triggers: [
    '可观测性',
    'observability',
    '监控',
    'monitoring',
    '日志',
    'logging',
    '链路追踪',
    'tracing',
    '指标',
    'metrics',
    'SLO',
    'SLA',
    '告警',
    'alerting',
    '@ethan 监控',
    '@ethan observability',
  ],
  steps: [
    {
      title: '1. 三支柱体系设计',
      content: `**可观测性三支柱（Three Pillars of Observability）**

| 支柱 | 回答的问题 | 工具栈 |
|------|-----------|--------|
| **Logs（日志）** | 发生了什么？ | Winston/Pino + ELK/Loki |
| **Metrics（指标）** | 系统状况如何？ | Prometheus + Grafana |
| **Traces（链路）** | 请求经过了哪里？ | OpenTelemetry + Jaeger/Tempo |

**选型建议**

\`\`\`
轻量级单体:  Pino + Prometheus + Grafana
微服务标准:  OpenTelemetry SDK → Collector → Jaeger + Prometheus + Loki
云原生托管:  Datadog / New Relic / AWS CloudWatch (开箱即用)
\`\`\`

**黄金信号（Golden Signals）— 4个必监控指标**

| 信号 | 说明 | 告警阈值示例 |
|------|------|-------------|
| **Latency（延迟）** | P50/P99/P999 响应时间 | P99 > 500ms |
| **Traffic（流量）** | RPS / 并发连接数 | 环比突增 50% |
| **Errors（错误率）** | 5xx / 业务错误比例 | > 0.1% |
| **Saturation（饱和度）** | CPU/内存/队列深度 | CPU > 80% |`,
    },
    {
      title: '2. 结构化日志规范',
      content: `**日志必须是结构化 JSON，不要用 console.log**

\`\`\`typescript
// ❌ Bad: 非结构化，无法机器解析
console.log(\`用户 \${userId} 下单失败: \${error.message}\`);

// ✅ Good: 结构化 JSON 日志（使用 Pino）
import pino from 'pino';
const logger = pino({ level: 'info' });

logger.error({
  event: 'order.create.failed',
  userId,
  orderId,
  errorCode: error.code,
  msg: error.message,
  durationMs: Date.now() - startTime,
});
\`\`\`

**日志级别规范**

| 级别 | 使用场景 | 生产建议 |
|------|---------|---------|
| ERROR | 需要立即处理的错误 | 触发告警 |
| WARN | 不影响功能但需关注 | 记录 + 汇总 |
| INFO | 关键业务事件（下单/登录） | 默认级别 |
| DEBUG | 调试信息，技术细节 | 生产关闭 |

**必带字段（Mandatory Fields）**

\`\`\`typescript
interface LogContext {
  traceId: string;    // 链路追踪 ID
  spanId: string;     // 当前 Span ID
  userId?: string;    // 用户 ID（有则带）
  requestId: string;  // 请求唯一 ID
  service: string;    // 服务名
  version: string;    // 服务版本
  env: string;        // prod / staging
}
\`\`\`

**日志采样策略**

\`\`\`typescript
// 高流量场景：ERROR 全量，INFO 10% 采样
const shouldLog = (level: string) =>
  level === 'error' || Math.random() < 0.1;
\`\`\``,
    },
    {
      title: '3. 指标采集与告警（Prometheus + Grafana）',
      content: `**RED 方法论（微服务推荐）**
- **R**ate — 每秒请求数
- **E**rrors — 错误率
- **D**uration — 请求时延分布

\`\`\`typescript
// Node.js 指标暴露（prom-client）
import { Counter, Histogram, register } from 'prom-client';

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Express 中间件
app.use((req, res, next) => {
  const end = httpDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    httpRequests.inc({ method: req.method, route: req.path, status: res.statusCode });
    end();
  });
  next();
});

// 暴露 /metrics 端点
app.get('/metrics', async (_, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
\`\`\`

**Grafana 告警规则示例（Alertmanager）**

\`\`\`yaml
groups:
  - name: api-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过 1%，当前: {{ $value | humanizePercentage }}"

      - alert: SlowP99
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 延迟超过 1s"
\`\`\``,
    },
    {
      title: '4. 分布式链路追踪（OpenTelemetry）',
      content: `**OpenTelemetry 是行业标准 —— 一次接入，多后端支持**

\`\`\`typescript
// 初始化 OTel（Node.js）
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations(), // 自动追踪 HTTP/Express/DB
  ],
  serviceName: 'order-service',
});
sdk.start();
\`\`\`

**手动创建 Span（业务关键路径）**

\`\`\`typescript
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('order-service');

async function createOrder(data: OrderData) {
  return tracer.startActiveSpan('order.create', async (span) => {
    try {
      span.setAttributes({
        'order.user_id': data.userId,
        'order.item_count': data.items.length,
        'order.total': data.total,
      });

      const order = await db.orders.create(data);
      span.setStatus({ code: SpanStatusCode.OK });
      return order;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
\`\`\`

**SLO 定义模板**

\`\`\`yaml
SLO: API 可用性
SLI: (成功请求数 / 总请求数) * 100%
目标: ≥ 99.9% (月度 = 允许 43.8 min 故障)
告警: 1h 内错误预算消耗 > 5% 时 PagerDuty 通知
\`\`\``,
    },
  ],
  outputFormat: 'Markdown 可观测性方案：技术栈选型 + 日志/指标/链路配置代码 + 告警规则 + SLO 定义',
  examples: [
    {
      input: '我的微服务出了问题，但我完全不知道哪里出了问题，怎么建立可观测性？',
      output: `## 可观测性建设方案（从零开始）

**优先级排序（按排查价值）**
1. 🔴 **结构化日志**（1天）：用 Pino 替换 console.log，统一 traceId 字段
2. 🟡 **健康检查 + 黄金信号**（2天）：/health + Prometheus 4个核心指标
3. 🟢 **链路追踪**（3天）：OTel 自动插桩，接入 Jaeger

**快速 Win：先加这 3 个指标**
- http_requests_total（按状态码）
- http_request_duration_p99
- active_db_connections

这 3 个指标已能覆盖 80% 的生产告警场景。`,
    },
  ],
  notes: [
    '可观测性要从项目初期建立，生产出了问题再加往往太晚',
    '日志一定要带 traceId，否则微服务间无法串联请求链路',
    'SLO 要与产品/业务方共同制定，不能只是技术侧自说自话',
    '告警要有"降噪"机制（for: 2m），避免毛刺误报打扰团队',
  ],
  nextSkill: 'design-patterns',
};
