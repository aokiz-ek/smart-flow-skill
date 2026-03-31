import type { SkillDefinition } from './types';

export const systemDesignSkill: SkillDefinition = {
  id: 'system-design',
  name: '系统设计',
  nameEn: 'system_design',
  order: 17,
  category: '执行侧',
  description: '从需求澄清到架构设计全流程，完成高并发分布式系统的方案设计与权衡分析',
  descriptionEn: 'Full system design process from requirement clarification to architecture with scalability and availability tradeoffs',
  detailDescription: `系统性指导大型系统设计流程，涵盖需求澄清与非功能指标量化、容量估算、高层架构选型、
核心组件设计、数据库模型与扩展性分析，帮助在面试或实际项目中输出结构清晰、考量全面的系统设计方案。`,
  triggers: [
    '系统设计',
    'system design',
    '架构设计',
    'architecture design',
    '高并发系统',
    '分布式系统',
    'distributed system',
    '容量估算',
    'capacity estimation',
    '扩展性设计',
    'scalability',
    '@ethan design',
    '@ethan system-design',
  ],
  steps: [
    {
      title: '1. 需求澄清与范围界定',
      content: `在动手设计前，花 5 分钟澄清需求：

**功能需求（Functional Requirements）**
- 系统的核心用例是什么？（写出 3-5 个最关键的）
- 哪些功能在 scope 内，哪些明确 out of scope？
- 用户角色有哪些？各自的主要操作是什么？

**非功能需求（Non-Functional Requirements）**

| 维度 | 问题 | 示例指标 |
|------|------|---------|
| 规模 | 用户量 / DAU / QPS 是多少？ | 1亿用户，1000万 DAU |
| 性能 | 读写延迟要求？P99 是多少？ | P99 < 100ms |
| 可用性 | 允许多少停机时间？ | 99.9%（每年 8.7h） |
| 一致性 | 强一致 or 最终一致？ | 最终一致（可接受） |
| 持久性 | 数据丢失容忍度？ | RPO = 0（不允许丢失） |

**明确边界的示例问题**
\`\`\`
Q: 设计一个 Twitter
A（先澄清）:
- 只需要发推/关注/Feed 功能吗？（排除私信、广告）
- 用户规模：3亿用户，1亿 DAU？
- 读写比例：推文读多写少，100:1？
- 媒体文件：支持图片/视频吗？
- 全球分发还是单地区？
\`\`\``,
    },
    {
      title: '2. 容量估算（Back-of-Envelope）',
      content: `快速估算系统规模，为架构决策提供数据依据：

**常用基准数字**
\`\`\`
内存访问：    ~100ns
SSD 访问：    ~100μs
HDD 访问：    ~10ms
网络往返（同数据中心）：~0.5ms
网络往返（跨地区）：    ~100ms

1 MB = 10^6 bytes
1 GB = 10^9 bytes
1 TB = 10^12 bytes
\`\`\`

**估算示例：设计微博（Twitter-like）**
\`\`\`
用户数据：
- DAU: 1亿
- 每用户每天发1条推文 → 写 QPS = 100M / 86400 ≈ 1160 QPS
- 每用户每天读100条 → 读 QPS = 100 × 1160 = 116,000 QPS

存储估算：
- 单条推文: 140字 × 2字节(UTF-16) = 280字节 ≈ 300字节
- 元数据(user_id, timestamp等): 100字节
- 每条推文总计: ~400字节
- 每日新增: 1.16K QPS × 400字节 × 86400 = ~40 GB/天
- 5年存储: 40GB × 365 × 5 ≈ 73 TB

带宽估算：
- 写带宽: 1160 × 400字节 = ~450 KB/s
- 读带宽: 116K × 400字节 = ~45 MB/s
\`\`\`

**结论：** 读多写少（100:1），需要读缓存；存储量大需分库分表；单机无法支撑读 QPS 需多副本。`,
    },
    {
      title: '3. 高层架构设计',
      content: `从整体入手，画出系统的核心模块和数据流：

**通用分层架构**
\`\`\`
客户端 (Web/Mobile/API Consumer)
         │
         ▼
   DNS + CDN (静态资源 / 地理路由)
         │
         ▼
   Load Balancer (L4/L7, 负载均衡 + SSL 终止)
    ┌────┴────┐
    ▼         ▼
 API Srv   API Srv   (无状态，水平扩展)
    │
    ├──→ Cache (Redis: 热数据)
    ├──→ Message Queue (Kafka: 异步解耦)
    ├──→ Primary DB (写操作)
    └──→ Read Replica (读操作)
         │
         ▼
   Object Storage (S3: 文件/媒体)
   Search Engine (Elasticsearch)
\`\`\`

**架构选型决策点**

| 场景 | 选型建议 |
|------|---------|
| 读多写少 | 读写分离 + 缓存层 |
| 高写入吞吐 | 异步消息队列削峰 |
| 数据量超百亿行 | 分库分表 / NoSQL |
| 强一致性 | 单主 / Paxos / Raft |
| 最终一致性 | 多主 / CRDT |
| 低延迟全球访问 | CDN + 多地域部署 |
| 复杂查询 | 专用搜索引擎 |

**微服务 vs 单体 决策**
- 团队 < 10人，初创期：单体优先（避免过度工程）
- 明确的服务边界、独立扩展需求：拆分微服务
- 拆分原则：按业务边界（DDD 限界上下文），而非技术层`,
    },
    {
      title: '4. 核心组件深度设计',
      content: `针对最关键的 2-3 个组件进行深入设计：

**数据库 Schema 设计**
\`\`\`sql
-- 示例：推文表设计
CREATE TABLE tweets (
  id          BIGINT PRIMARY KEY,      -- Snowflake ID（分布式唯一ID）
  user_id     BIGINT NOT NULL,
  content     VARCHAR(280) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  like_count  INT DEFAULT 0,
  retweet_count INT DEFAULT 0,
  INDEX idx_user_created (user_id, created_at DESC)  -- 用户时间线查询
);

-- Fan-out 策略：预写 vs 拉取
-- 方案A: Push（写扩散）: 发推时写入所有粉丝的 Feed 表
-- 方案B: Pull（读扩散）: 读取时聚合关注者的推文
-- 混合方案: 普通用户 Push，大V（粉丝>100万）Pull
\`\`\`

**缓存策略**
\`\`\`
Cache-Aside（旁路缓存）- 最通用
读: 查缓存 → miss → 查DB → 写缓存 → 返回
写: 更新DB → 删除缓存（避免双写不一致）

Write-Through（写穿）- 一致性高
写: 同时写DB和缓存

Write-Behind（写回）- 高性能
写: 先写缓存，异步批量写DB（风险：缓存宕机丢数据）

缓存 Key 设计示例:
user:{userId}:profile      → 用户资料
user:{userId}:feed:page:{n} → 用户 Feed 分页
tweet:{tweetId}            → 单条推文
\`\`\`

**API 接口设计**
\`\`\`
POST /tweets              发布推文
GET  /users/{id}/feed     获取 Feed (cursor分页)
POST /tweets/{id}/like    点赞
GET  /tweets/{id}         获取单条推文

分页策略: cursor-based > offset-based（大数据量场景）
cursor: base64(created_at + tweet_id)
\`\`\``,
    },
    {
      title: '5. 可扩展性与可用性权衡',
      content: `**CAP 定理实践**
\`\`\`
C（一致性）+ A（可用性）+ P（分区容错）三选二
网络分区不可避免 → 通常是 CP 或 AP 的选择

CP 系统: ZooKeeper, HBase（金融交易、库存扣减）
AP 系统: Cassandra, DynamoDB（社交Feed、购物车）
\`\`\`

**水平扩展策略**

| 层次 | 策略 |
|------|------|
| 无状态应用层 | 直接水平扩展 + 负载均衡 |
| 有状态缓存 | 一致性哈希分片（Redis Cluster） |
| 数据库水平 | 分库分表（按 user_id % N） |
| 数据库垂直 | 主从复制，读写分离 |

**单点故障（SPOF）消除清单**
- [ ] Load Balancer 双活/主备
- [ ] 数据库主从 + 自动故障转移（MHA/Orchestrator）
- [ ] 缓存集群（Redis Sentinel / Cluster）
- [ ] 消息队列多副本（Kafka Replication Factor ≥ 3）
- [ ] 跨可用区部署（Multi-AZ）

**限流与熔断**
\`\`\`
限流: Token Bucket（突发流量友好）
     Sliding Window（精准限流）
     分级限流: 用户级 → 接口级 → 全局

熔断: Closed → Open（失败率>50%）→ Half-Open（探测恢复）
工具: Resilience4j（Java）/ hystrix-go / Polly(.NET)
\`\`\``,
    },
    {
      title: '6. 输出系统设计文档',
      content: `整理为结构化设计文档：

\`\`\`markdown
## 系统设计方案：[系统名称]

### 1. 需求概述
**功能需求**（核心功能列表）
**非功能需求**（QPS / 延迟 / 可用性 / 存储）

### 2. 容量估算
| 指标 | 估算值 |
|------|-------|
| DAU | X 万 |
| 写 QPS | X |
| 读 QPS | X |
| 存储（5年） | X TB |

### 3. 系统架构图
[ASCII 图或 Mermaid 图]

### 4. 核心组件设计
- **数据库 Schema**：[关键表设计]
- **缓存策略**：[策略选择与理由]
- **API 设计**：[关键接口]

### 5. 扩展性方案
- **瓶颈点**：[识别的瓶颈]
- **解决方案**：[具体方案]

### 6. 权衡与风险
[已知权衡和设计风险]
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 系统设计文档，含需求澄清结果、容量估算数据、架构图、核心组件设计方案和扩展性权衡分析',
  examples: [
    {
      input: '设计一个短链接服务（如 bit.ly）',
      output: `## 短链接服务设计

**规模**：每天 1 亿次创建，10 亿次访问（10:1 读写比）
**写 QPS**：~1160，**读 QPS**：~11600，存储5年：~40TB

**核心架构**：Web → LB → API Server → Redis（热门短链缓存）→ Cassandra（主存储）

**短链生成**：Base62 编码 7位（62^7 ≈ 3500亿，够用）
- 方案A: 预生成随机串存DB（无冲突）
- 方案B: ID自增 → Base62编码（简单高效，推荐）

**重定向**：301（永久，浏览器缓存，减少服务压力）vs 302（临时，可统计点击）
**数据库**：Cassandra（key-value 访问模式完美匹配，易扩展）`,
    },
  ],
  notes: [
    '系统设计没有标准答案，重点展示思考过程和权衡意识',
    '先画出高层架构，再逐步深入细节，避免一开始陷入细节',
    '主动提出设计中的权衡和不足，展示对复杂度的认知',
    '数量级估算误差在 10x 以内即可，重要的是数量级概念',
  ],
  nextSkill: 'database-optimize',
};
