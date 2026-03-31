import type { SkillDefinition } from './types';

export const databaseOptimizeSkill: SkillDefinition = {
  id: 'database-optimize',
  name: '数据库优化',
  nameEn: 'database_optimize',
  order: 18,
  category: '质量侧',
  description: '系统诊断数据库性能问题，涵盖 Schema 审查、索引设计、慢查询分析和 N+1 修复',
  descriptionEn: 'Diagnose and optimize database performance covering schema review, index design, slow query analysis, and N+1 fixes',
  detailDescription: `端到端数据库性能优化指导，从 Schema 设计审查、索引策略制定、慢查询日志分析、
N+1 查询识别与修复，到分区分表策略，帮助系统在数据量增长时保持查询性能。`,
  triggers: [
    '数据库优化',
    'database optimize',
    '慢查询',
    'slow query',
    'SQL 优化',
    'SQL optimization',
    '索引优化',
    'index optimization',
    'N+1 问题',
    'N+1 query',
    '查询性能',
    'query performance',
    '@ethan db',
    '@ethan database-optimize',
  ],
  steps: [
    {
      title: '1. Schema 设计审查',
      content: `检查数据库表结构是否存在设计问题：

**规范化检查（防止冗余）**
\`\`\`sql
-- ❌ 反模式：在用户表存储地址字符串
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  address VARCHAR(500)  -- 难以精准查询城市/省份
);

-- ✅ 正确：拆分为 addresses 表
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
CREATE TABLE addresses (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  province VARCHAR(50),
  city VARCHAR(50),
  detail VARCHAR(200)
);
\`\`\`

**数据类型选择**

| 场景 | 推荐类型 | 避免 |
|------|---------|------|
| 主键 | BIGINT / UUID | INT（可能溢出） |
| 状态枚举 | TINYINT / ENUM | VARCHAR |
| 金额 | DECIMAL(10,2) | FLOAT（精度丢失）|
| 时间 | TIMESTAMP / DATETIME | VARCHAR |
| 短字符串(≤255) | VARCHAR(N) | TEXT |
| 布尔值 | TINYINT(1) | VARCHAR('true') |

**常见 Schema 问题清单**
- [ ] 是否有未使用的列？
- [ ] VARCHAR 长度是否合理（不要都 VARCHAR(255)）？
- [ ] 外键是否有索引？
- [ ] 是否有重复的字段（非规范化导致）？
- [ ] 是否用了 TEXT/BLOB 存储应该单独存储的大文件？`,
    },
    {
      title: '2. 索引设计策略',
      content: `**索引类型选择**

\`\`\`sql
-- 单列索引：高选择性字段（如 email、手机号）
CREATE INDEX idx_users_email ON users(email);

-- 联合索引：遵循最左前缀原则
-- 适合查询: WHERE status = ? AND created_at > ?
-- 适合查询: WHERE status = ?
-- 不适合:   WHERE created_at > ?  （无法命中）
CREATE INDEX idx_orders_status_created ON orders(status, created_at);

-- 覆盖索引：索引包含查询所有字段，避免回表
-- 查询: SELECT user_id, status FROM orders WHERE order_no = ?
CREATE INDEX idx_orders_covering ON orders(order_no, user_id, status);

-- 前缀索引：长字符串节省空间
CREATE INDEX idx_url_prefix ON pages(url(50));

-- 函数索引（MySQL 8.0+）：对表达式建索引
CREATE INDEX idx_lower_email ON users((LOWER(email)));
\`\`\`

**EXPLAIN 分析索引使用**
\`\`\`sql
EXPLAIN SELECT * FROM orders
WHERE user_id = 1001 AND status = 'PAID'
ORDER BY created_at DESC LIMIT 10;

-- 关注字段:
-- type:  ref > range > index > ALL（ALL 最差）
-- key:   使用的索引名（NULL 表示未使用索引）
-- rows:  预估扫描行数（越小越好）
-- Extra: Using filesort / Using temporary（需优化的信号）
\`\`\`

**索引原则**
- 高频查询的 WHERE / JOIN / ORDER BY 字段建索引
- 选择性低的字段慎建索引（如 status 只有3个值）
- 避免在频繁更新的列上建过多索引（写性能代价）
- 复合索引字段顺序：等值条件在前，范围条件在后`,
    },
    {
      title: '3. 慢查询分析与优化',
      content: `**开启慢查询日志**
\`\`\`sql
-- MySQL 配置
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 超过1秒记录
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 查看慢查询日志文件位置
SHOW VARIABLES LIKE 'slow_query_log_file';

-- 使用 pt-query-digest 分析日志
pt-query-digest /var/log/mysql/slow.log | head -100
\`\`\`

**常见慢查询模式与修复**
\`\`\`sql
-- ❌ 问题1: SELECT * 全列查询
SELECT * FROM orders WHERE user_id = 1001;
-- ✅ 修复: 只查需要的列
SELECT id, order_no, status, total FROM orders WHERE user_id = 1001;

-- ❌ 问题2: 对索引列使用函数，导致索引失效
SELECT * FROM orders WHERE DATE(created_at) = '2024-01-01';
-- ✅ 修复: 使用范围查询
SELECT * FROM orders
WHERE created_at >= '2024-01-01' AND created_at < '2024-01-02';

-- ❌ 问题3: OR 导致索引失效（某些情况）
SELECT * FROM users WHERE email = ? OR phone = ?;
-- ✅ 修复: UNION ALL
SELECT * FROM users WHERE email = ?
UNION ALL
SELECT * FROM users WHERE phone = ?;

-- ❌ 问题4: LIKE 前缀通配符
SELECT * FROM products WHERE name LIKE '%iPhone%';
-- ✅ 修复: 使用全文索引或 Elasticsearch
SELECT * FROM products WHERE MATCH(name) AGAINST('iPhone' IN BOOLEAN MODE);

-- ❌ 问题5: 隐式类型转换
SELECT * FROM users WHERE user_id = '1001';  -- user_id 是 INT
-- ✅ 修复: 类型匹配
SELECT * FROM users WHERE user_id = 1001;
\`\`\``,
    },
    {
      title: '4. N+1 查询识别与修复',
      content: `**N+1 问题定义**：查询1次获取N条记录，再针对每条记录查询1次，共 N+1 次数据库访问。

**ORM 场景中的 N+1**
\`\`\`typescript
// ❌ TypeORM N+1 示例：查100个用户 → 执行101次SQL
const users = await userRepository.find();  // Query 1: SELECT * FROM users
for (const user of users) {
  const orders = await user.orders;         // Query 2-101: 每个用户各查一次
  console.log(orders.length);
}

// ✅ 修复：使用 eager loading（JOIN）
const users = await userRepository.find({
  relations: ['orders'],  // 一次 JOIN 查询搞定
});

// ✅ 或使用 QueryBuilder（更精确控制）
const users = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.orders', 'order')
  .where('order.status = :status', { status: 'PAID' })
  .getMany();
\`\`\`

**原生 SQL 批量查询模式**
\`\`\`sql
-- ❌ N+1: 循环查询
-- for user_id in user_ids: SELECT * FROM orders WHERE user_id = ?

-- ✅ 批量查询 + 应用层 Map 聚合
SELECT user_id, COUNT(*) as order_count, SUM(total) as total_amount
FROM orders
WHERE user_id IN (1,2,3,...,100)  -- 一次查询
GROUP BY user_id;
-- 在应用层用 Map 按 user_id 聚合
\`\`\`

**检测 N+1 工具**
\`\`\`
- Laravel Debugbar（PHP）
- Django Debug Toolbar（Python）
- Bullet gem（Rails）
- TypeORM logging: { logging: true } 观察 SQL 数量
- DataLoader（GraphQL 场景批量加载）
\`\`\``,
    },
    {
      title: '5. 分区与分表策略',
      content: `**表分区（Partitioning）— 单机方案**
\`\`\`sql
-- 按时间范围分区（适合日志、订单历史）
CREATE TABLE orders (
  id BIGINT,
  user_id INT,
  created_at DATETIME,
  total DECIMAL(10,2)
) PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2022 VALUES LESS THAN (2023),
  PARTITION p2023 VALUES LESS THAN (2024),
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION pmax  VALUES LESS THAN MAXVALUE
);

-- 分区裁剪：查询自动只扫描相关分区
SELECT * FROM orders WHERE created_at >= '2024-01-01';
-- 只扫描 p2024 分区，跳过历史分区
\`\`\`

**分库分表策略（超千万行后考虑）**

| 方案 | 分片键选择 | 适用场景 |
|------|----------|---------|
| 水平分表（同库） | user_id % N | 单库容量瓶颈 |
| 水平分库 | user_id % N | 读写 QPS 瓶颈 |
| 按地区分库 | region | 合规/延迟要求 |

\`\`\`
分片键选择原则:
- 选择查询中高频使用的字段（避免跨分片查询）
- 选择数据分布均匀的字段（避免热点）
- 一旦确定不能轻易更改

常见工具:
- ShardingSphere（Java）
- Vitess（MySQL 集群，YouTube 方案）
- Citus（PostgreSQL 分布式扩展）
\`\`\`

**读写分离配置**
\`\`\`
主库（Primary）: 处理写操作 + 强一致读
从库（Replica）: 处理读操作（注意主从延迟，通常 <1s）

适用于读写比 > 4:1 的场景
注意: 写后立即读可能读到旧数据（主从同步延迟）
解决: 重要读操作路由到主库；或用 Redis 缓存最新写入
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 优化报告，含 Schema 问题列表、索引设计方案、慢查询 EXPLAIN 分析、N+1 修复代码示例和分区建议',
  examples: [
    {
      input: '用户列表页加载很慢，查询订单表，数据量1000万行',
      output: `## 数据库性能诊断

**Step 1: 执行 EXPLAIN**
\`\`\`sql
EXPLAIN SELECT o.*, u.name FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'PAID' ORDER BY o.created_at DESC LIMIT 20;
\`\`\`

**发现问题**：type = ALL（全表扫描），rows = 10,000,000

**优化方案**：
1. 添加联合索引：\`CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);\`
2. 加 users 表关联索引：\`CREATE INDEX idx_users_id ON users(id);\`（通常主键已有）
3. 预期效果：rows 从 1000万 降至 <1000，响应时间从 5s → 50ms`,
    },
  ],
  notes: [
    '优化前先用 EXPLAIN 分析，避免盲目加索引',
    '索引不是越多越好，每个索引都会降低写入性能，控制在 5-8 个以内',
    '分库分表是最后手段，优先考虑索引优化、缓存、读写分离',
    '生产环境加索引使用 gh-ost 或 pt-online-schema-change，避免锁表',
  ],
  nextSkill: 'docker',
};
