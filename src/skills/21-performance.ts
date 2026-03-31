import type { SkillDefinition } from './types';

export const performanceSkill: SkillDefinition = {
  id: 'performance',
  name: '性能优化',
  nameEn: 'performance',
  order: 21,
  category: '质量侧',
  description: '系统化分析和优化前后端性能瓶颈，涵盖分析工具使用、优化策略和量化指标',
  descriptionEn: 'Systematically analyze and optimize frontend/backend performance bottlenecks with profiling tools and metrics',
  detailDescription: `从性能指标定义、瓶颈定位到针对性优化，覆盖前端（Core Web Vitals）、后端（数据库、缓存）三个层次，建立可量化的性能优化体系。`,
  triggers: [
    '性能优化',
    'performance',
    '页面慢',
    '接口慢',
    '性能分析',
    'profiling',
    'Core Web Vitals',
    '@ethan 性能',
    '/性能优化',
  ],
  steps: [
    {
      title: '1. 建立性能基线与目标',
      content: `优化前先量化，避免盲目优化。

**前端核心指标（Core Web Vitals）**
| 指标 | 含义 | 优秀 | 需改进 | 差 |
|------|------|------|--------|-----|
| LCP | 最大内容绘制 | ≤ 2.5s | ≤ 4s | > 4s |
| INP | 交互响应延迟 | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | 累积布局偏移 | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB | 首字节时间 | ≤ 800ms | ≤ 1.8s | > 1.8s |

**采集工具**
\`\`\`bash
npm install -g @lhci/cli
lhci autorun --collect.url=https://yoursite.com

npx autocannon -c 100 -d 30 http://localhost:3000/api/users
\`\`\``,
    },
    {
      title: '2. 前端性能优化',
      content: `**资源加载优化**
\`\`\`html
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preconnect" href="https://api.example.com">
<img src="hero.jpg" loading="eager" fetchpriority="high" />
<img src="below-fold.jpg" loading="lazy" />
\`\`\`

**代码拆分（React）**
\`\`\`typescript
const UserProfile = lazy(() => import('./pages/UserProfile'));

// 虚拟列表（大数据量）
import { FixedSizeList } from 'react-window';
<FixedSizeList height={600} itemCount={10000} itemSize={50}>
  {({ index, style }) => <div style={style}>Row {index}</div>}
</FixedSizeList>
\`\`\`

**打包体积优化**
\`\`\`bash
npx vite-bundle-visualizer
# Tree-shaking: 按需引入
import { debounce } from 'lodash-es';  // ✅ 非 import _ from 'lodash'
\`\`\``,
    },
    {
      title: '3. 后端与数据库性能优化',
      content: `**数据库查询优化**
\`\`\`sql
EXPLAIN ANALYZE SELECT u.*, COUNT(o.id)
FROM users u LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active' GROUP BY u.id;

-- 复合索引
CREATE INDEX idx_user_status_created ON users(status, created_at);
\`\`\`

**缓存策略（Redis）**
\`\`\`typescript
async function getUserProfile(userId: string) {
  const cacheKey = \`user:profile:\${userId}\`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const user = await db.users.findUnique({ where: { id: userId } });
  const ttl = 300 + Math.floor(Math.random() * 60); // 随机TTL防雪崩
  await redis.setex(cacheKey, ttl, JSON.stringify(user));
  return user;
}
\`\`\`

**并行化异步操作**
\`\`\`typescript
// ✅ 并行（快）
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
\`\`\``,
    },
    {
      title: '4. 性能优化 Checklist 与持续监控',
      content: `**优化优先级矩阵**
| 优化项 | 影响 | 成本 | 优先级 |
|--------|------|------|--------|
| 图片压缩/WebP | 高 | 低 | 🔴 立即 |
| 关键资源预加载 | 高 | 低 | 🔴 立即 |
| 数据库慢查询修复 | 高 | 中 | 🔴 立即 |
| 代码拆分/懒加载 | 高 | 中 | 🟡 近期 |
| Redis 缓存层 | 高 | 高 | 🟡 规划 |

**Lighthouse CI 集成**
\`\`\`yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: https://yoursite.com
    uploadArtifacts: true
\`\`\`

**性能优化报告模板**
\`\`\`
优化前：LCP 4.8s | FCP 3.2s | P99 API 1200ms
已实施：图片WebP → LCP -1.8s；加索引 → P99 -600ms
优化后：LCP 2.3s ✅ | FCP 1.4s ✅ | P99 380ms ✅
\`\`\``,
    },
  ],
  outputFormat: 'Markdown 性能分析报告，含当前指标基线、瓶颈列表、优化方案和预期收益',
  notes: [
    '先测量再优化，不要猜测瓶颈，用数据说话',
    'Core Web Vitals 直接影响 Google SEO 排名',
    '缓存是最有效的优化，但要仔细设计失效策略',
  ],
};
