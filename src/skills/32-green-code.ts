import type { SkillDefinition } from './types';

export const greenCodeSkill: SkillDefinition = {
  id: 'green-code',
  name: '绿色编码实践',
  nameEn: 'green_code',
  order: 32,
  description: '识别代码能耗热点，优化算法复杂度与云资源效率，估算并降低软件碳排放',
  descriptionEn: 'Identify code energy hotspots, optimize algorithm complexity and cloud resource efficiency, estimate and reduce software carbon footprint',
  detailDescription: `软件系统的碳排放已成为不可忽视的环境责任——全球 IT 行业贡献了约 2-4% 的碳排放。
本 Skill 提供务实的绿色编码方法：从识别 CPU 密集、无效轮询、内存泄漏等能耗热点，
到算法复杂度优化和云资源 Right-sizing，再到前端绿色实践和碳排放量化，
让工程师在不牺牲性能的前提下写出更节能的代码。`,
  triggers: [
    '绿色编码',
    'green code',
    'green software',
    'carbon footprint',
    '能耗优化',
    'sustainable code',
    '碳排放',
    '节能',
    '@ethan green-code',
    '/green-code',
  ],
  steps: [
    {
      title: '1. 能耗热点识别',
      content: `扫描代码库，定位高能耗模式：

**六大能耗反模式**

| 反模式 | 表现 | 能耗级别 |
|--------|------|---------|
| **无效轮询** | \`while(true) { check(); sleep(100) }\` | 🔴 极高 |
| **CPU 密集循环** | 嵌套循环处理大数据集 | 🔴 极高 |
| **内存泄漏** | 对象无法被 GC 回收 | 🟠 高 |
| **冗余网络请求** | 重复请求相同资源 | 🟠 高 |
| **过度序列化** | 频繁 JSON.stringify 大对象 | 🟡 中 |
| **阻塞 I/O** | 同步文件读写阻塞主线程 | 🟡 中 |

**识别工具命令**
\`\`\`bash
# Node.js — CPU Profile
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# 内存快照（Node.js）
node --heap-prof app.js

# 前端 — Chrome DevTools
# Performance 面板 → Record → 分析 Long Tasks（>50ms）

# Python — cProfile
python -m cProfile -o output.prof app.py
python -m pstats output.prof  # 查看热点函数
\`\`\`

**无效轮询重构**
\`\`\`typescript
// ❌ 能耗高：每 100ms 轮询
while (true) {
  const status = await checkJobStatus(jobId);
  if (status === 'done') break;
  await sleep(100);
}

// ✅ 绿色：指数退避 + 最大间隔
async function pollWithBackoff(jobId: string) {
  let delay = 500;
  const MAX_DELAY = 30000;
  while (true) {
    const status = await checkJobStatus(jobId);
    if (status === 'done') return;
    await sleep(Math.min(delay, MAX_DELAY));
    delay *= 1.5;
  }
}

// ✅ 更绿色：WebSocket / SSE（服务端推送，零轮询）
const ws = new WebSocket('/api/jobs/status');
ws.onmessage = (e) => handleUpdate(JSON.parse(e.data));
\`\`\`

**输出**：能耗热点清单（位置 + 类型 + 估算影响）`,
    },
    {
      title: '2. 算法复杂度优化',
      content: `用低复杂度算法替换高能耗实现：

**复杂度对碳排放的影响（1M 数据量对比）**
\`\`\`
O(n²)  → 10^12 操作 → 约 100W CPU 秒  🔴
O(n log n) → 2×10^7 操作 → 约 20ms     🟢
O(n)   → 10^6 操作  → 约 1ms          🟢
O(1)   → 1 操作     → 即时            🟢
\`\`\`

**常见优化模式**

**① 嵌套循环 → 哈希查找**
\`\`\`typescript
// ❌ O(n²) — 大数据量极度消耗 CPU
function findMatches(users: User[], orders: Order[]) {
  return orders.filter(order =>
    users.some(user => user.id === order.userId) // O(n) per order
  );
}

// ✅ O(n) — 预建索引
function findMatchesOptimized(users: User[], orders: Order[]) {
  const userMap = new Map(users.map(u => [u.id, u]));  // 一次性 O(n)
  return orders.filter(order => userMap.has(order.userId)); // O(1) per order
}
\`\`\`

**② 重复计算 → 缓存/记忆化**
\`\`\`typescript
// ❌ 每次调用重新计算
function expensiveCalc(n: number) { /* O(2^n) */ }

// ✅ 记忆化缓存
const memo = new Map<number, number>();
function cachedCalc(n: number): number {
  if (memo.has(n)) return memo.get(n)!;
  const result = expensiveCalc(n);
  memo.set(n, result);
  return result;
}
\`\`\`

**③ 大列表操作 → 流式处理**
\`\`\`typescript
// ❌ 全量加载到内存
const allRecords = await db.findAll(); // 可能 100MB
processAll(allRecords);

// ✅ 流式分批处理
const BATCH = 1000;
for await (const batch of db.findInBatches(BATCH)) {
  await processBatch(batch);
}
\`\`\`

**输出**：算法优化建议 + 重构前后复杂度对比`,
    },
    {
      title: '3. 云资源效率优化',
      content: `减少云资源浪费，降低运行能耗：

**云资源三大浪费来源**
\`\`\`
1. Over-provisioning（过度配置）：实际 CPU 利用率 < 20%，却购买了大型实例
2. 僵尸资源：停止的 EC2、未挂载的 EBS 卷、空闲的 NAT 网关
3. 低效架构：长时间运行的大实例 vs. Serverless 按需执行
\`\`\`

**Right-sizing 实践**
\`\`\`bash
# AWS — 查看 CPU 利用率趋势（CloudWatch）
aws cloudwatch get-metric-statistics \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-xxxx \
  --start-time 2024-01-01T00:00:00 \
  --end-time 2024-01-31T00:00:00 \
  --period 86400 --statistics Average

# 建议：平均 CPU < 20% → 降低一档实例类型
# m5.xlarge (4 vCPU) → m5.large (2 vCPU) = 节省 50% 成本和能耗
\`\`\`

**自动伸缩配置（节能关键）**
\`\`\`yaml
# Kubernetes HPA — 按 CPU 自动伸缩
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
spec:
  minReplicas: 1   # 低峰期缩减到 1 个副本
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
\`\`\`

**Serverless 适用场景**
\`\`\`
适合 Serverless（事件驱动，闲时零消耗）：
✅ 图片处理、文件转换
✅ 定时任务、数据同步
✅ Webhook 处理器

不适合 Serverless（冷启动延迟不可接受）：
❌ 实时游戏服务器
❌ 高频低延迟 API（< 100ms SLA）
\`\`\`

**输出**：云资源优化建议（Right-sizing + 自动伸缩 + 架构选型）`,
    },
    {
      title: '4. 前端绿色实践',
      content: `减少前端资源消耗，降低设备端能耗：

**前端能耗五大优化**

**① JavaScript Bundle 瘦身**
\`\`\`bash
# 分析 Bundle 大小
npx webpack-bundle-analyzer stats.json
npx vite-bundle-visualizer

# 目标：首屏 JS < 150KB (gzipped)
\`\`\`

\`\`\`typescript
// ✅ Tree-shaking（只导入用到的函数）
import { debounce } from 'lodash-es';  // 不要 import _ from 'lodash'

// ✅ 动态导入（按需加载非关键模块）
const HeavyChart = lazy(() => import('./HeavyChart'));

// ✅ 外部化大型库（CDN 缓存复用）
// vite.config.ts
build: { rollupOptions: { external: ['react', 'react-dom'] } }
\`\`\`

**② 图片优化**
\`\`\`html
<!-- ✅ 现代格式 + 响应式 -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" width="800" height="600"
       loading="lazy" decoding="async" alt="...">
</picture>
<!-- WebP 比 JPEG 小 30%，AVIF 比 JPEG 小 50% -->
\`\`\`

**③ CSS 精简**
\`\`\`bash
# PurgeCSS — 移除未使用的 CSS
npx purgecss --css dist/*.css --content dist/*.html dist/*.js --output dist/
\`\`\`

**④ 减少不必要的动画**
\`\`\`css
/* 尊重用户的省电模式偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
\`\`\`

**⑤ 高效 DOM 操作**
\`\`\`typescript
// ❌ 频繁触发 Reflow
items.forEach(item => {
  item.style.width = container.offsetWidth + 'px'; // 每次读写触发 Reflow
});

// ✅ 批量读后批量写
const width = container.offsetWidth; // 一次读取
items.forEach(item => { item.style.width = width + 'px'; }); // 批量写
\`\`\`

**输出**：前端绿色实践清单 + Bundle 分析建议`,
    },
    {
      title: '5. 碳排放估算',
      content: `用 SCI（Software Carbon Intensity）公式量化软件碳排放：

**SCI 公式**
\`\`\`
SCI = (E × I) + M

E = 软件消耗的电能（kWh）
I = 电网碳强度（gCO₂eq/kWh）— 取决于服务器所在地区
M = 硬件制造碳排放（均摊到使用寿命）
\`\`\`

**各地区电网碳强度参考**
\`\`\`
地区          碳强度 (gCO₂eq/kWh)
─────────────────────────────────
西欧 / Nordic   ~150-300  （可再生能源占比高）
us-east-1       ~350-400
ap-northeast-1  ~450-500  （日本，主要火电）
cn-north-1      ~550-600  （中国，煤电为主）
AWS GovCloud    ~200      （承诺使用清洁能源）
\`\`\`

**API 服务碳排放估算示例**
\`\`\`
假设：
- API 服务器：4 vCPU，平均 40% 利用率
- TDP（热设计功耗）：100W（4 vCPU 服务器）
- 实际功耗：100W × 40% × PUE(1.2) = 48W
- 每月运行：48W × 730h = 35 kWh
- 碳排放（us-east-1，380 gCO₂/kWh）：
  35 × 380 = 13,300 gCO₂ = 13.3 kg CO₂/月

优化后（CPU 利用率从 40% 优化到 20% 后缩容）：
  12W × 730h × 380 / 1000 = 3.3 kg CO₂/月
  节省：10 kg CO₂/月（减少 75%）
\`\`\`

**绿色目标设定**
\`\`\`
当前基准: ___ gCO₂/1000 API 请求
目标（3个月）: 降低 30%
目标（1年）: 迁移到低碳区域（or 可再生能源数据中心）
\`\`\`

**Carbon.txt 声明**（向用户公示绿色承诺）
\`\`\`
# /carbon.txt
We are committed to reducing our software's carbon footprint.
Hosting: AWS us-west-2 (powered by renewable energy)
Current SCI: 15g CO₂eq per 1000 requests
Target: < 10g CO₂eq per 1000 requests by 2025
\`\`\`

**输出**：碳排放基准报告 + SCI 计算表 + 减碳路线图`,
    },
  ],
  outputFormat: '能耗热点报告 + 算法优化建议 + 云资源 Right-sizing 方案 + 前端绿色实践 Checklist + 碳排放估算（SCI）',
  examples: [],
  notes: [
    '绿色编码和性能优化高度重合——节能的代码往往也是更快的代码，两者并不冲突',
    '将服务器迁移到使用可再生能源的区域（如 AWS us-west-2 Oregon）是降低碳排放最立竿见影的方式',
    '前端优化对碳排放影响巨大：每减少 1KB JS，每百万用户每年可节省约 0.5 kg CO₂',
    'SCI 指标建议纳入团队 KPI，每季度度量，与其他工程指标（性能/可用性）并列追踪',
    '使用 AWS Customer Carbon Footprint Tool 或 Google Cloud Carbon Footprint 获取真实数据',
  ],
  category: '质量侧',
  nextSkill: 'performance',
};
