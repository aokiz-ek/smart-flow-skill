import type { SkillDefinition } from './types';

export const dataMigrationSkill: SkillDefinition = {
  id: 'data-migration',
  name: '数据迁移助手',
  nameEn: 'data_migration',
  order: 29,
  description: '评估迁移风险，生成 UP/DOWN 双向脚本，制定零停机迁移与回滚方案',
  descriptionEn: 'Assess migration risks, generate bidirectional UP/DOWN scripts, design zero-downtime migration and rollback plans',
  detailDescription: `数据迁移是研发中风险最高的操作之一：一旦出错可能导致数据丢失或服务中断。
本 Skill 提供系统化的迁移方法论：从评估阶段的风险识别，到生成双向迁移脚本，
再到零停机迁移的"扩列→双写→切流→清旧"四步法，每个环节都有完整的验证与回滚手段，
让数据迁移从"胆战心惊"变为"有序可控"。`,
  triggers: [
    '数据迁移',
    'data migration',
    'schema migration',
    'db migration',
    '数据库迁移',
    'migrate database',
    'migration script',
    '迁移脚本',
    '@ethan data-migration',
    '/data-migration',
  ],
  steps: [
    {
      title: '1. 迁移评估',
      content: `在编写任何脚本之前，先全面评估迁移的范围和风险：

**评估清单**

| 维度 | 问题 | 影响 |
|------|------|------|
| **数据量** | 涉及多少行/多少 GB？ | 决定迁移时长和窗口 |
| **Schema 变更** | 新增/修改/删除了哪些列？ | 影响向后兼容性 |
| **外键约束** | 是否有级联影响？ | 需要临时禁用约束 |
| **业务流量** | 高峰期 QPS 是多少？ | 影响迁移策略选择 |
| **停机容忍** | 是否接受停机？接受多长？ | 决定是否需要零停机方案 |
| **数据一致性** | 允许最终一致性还是强一致？ | 影响双写策略 |

**Schema 变更对比**
\`\`\`sql
-- 变更前
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(50),
  created_at TIMESTAMP
);

-- 变更后（新增 email 列，重命名 username → name）
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100),         -- 原 username，扩大长度
  email VARCHAR(255),        -- 新增，NOT NULL 需要默认值
  created_at TIMESTAMP,
  updated_at TIMESTAMP       -- 新增审计列
);
\`\`\`

**停机时间估算**
\`\`\`
数据行数: 5,000,000
迁移速度: ~10,000 行/秒（受磁盘 IO 限制）
估算时长: 5,000,000 ÷ 10,000 = 500 秒 ≈ 8.3 分钟
建议窗口: 低峰期（凌晨 2:00-4:00）
\`\`\`

**输出**：迁移评估报告（范围 + 风险 + 时长估算 + 策略选择）`,
    },
    {
      title: '2. 迁移脚本生成（UP/DOWN）',
      content: `生成可逆的双向迁移脚本：

**Knex.js 迁移模板（Node.js）**
\`\`\`typescript
// migrations/20240115_add_email_rename_username.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    // 1. 新增列（先加，允许 NULL，稍后回填）
    table.string('name', 100).nullable();
    table.string('email', 255).nullable();
    table.timestamp('updated_at').nullable();
  });

  // 2. 数据回填（分批处理，避免锁表）
  const BATCH_SIZE = 1000;
  let offset = 0;
  while (true) {
    const rows = await knex('users')
      .select('id', 'username')
      .limit(BATCH_SIZE)
      .offset(offset);
    if (rows.length === 0) break;

    await knex('users')
      .whereIn('id', rows.map((r) => r.id))
      .update((row: any) => ({ name: row.username }));

    offset += BATCH_SIZE;
  }

  // 3. 添加约束
  await knex.schema.alterTable('users', (table) => {
    table.string('name', 100).notNullable().alter();
    table.dropColumn('username'); // 危险操作！确认数据回填完成后执行
  });
}

export async function down(knex: Knex): Promise<void> {
  // 回滚：恢复 username 列
  await knex.schema.alterTable('users', (table) => {
    table.string('username', 50).nullable();
    table.dropColumn('name');
    table.dropColumn('email');
    table.dropColumn('updated_at');
  });

  // 回填 username（从备份表恢复）
  await knex.raw('UPDATE users u JOIN users_backup b ON u.id = b.id SET u.username = b.username');
}
\`\`\`

**Flyway SQL 迁移模板**
\`\`\`sql
-- V20240115__add_email_rename_username.sql
BEGIN;

-- 阶段1：新增列
ALTER TABLE users ADD COLUMN name VARCHAR(100);
ALTER TABLE users ADD COLUMN email VARCHAR(255);
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- 阶段2：数据回填
UPDATE users SET name = username WHERE name IS NULL;

-- 阶段3：添加约束（回填完成后）
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

COMMIT;
\`\`\`

**输出**：可执行的 UP/DOWN 迁移脚本`,
    },
    {
      title: '3. 数据验证策略',
      content: `迁移前后必须验证数据完整性：

**三阶段验证**

**① 迁移前基线（Baseline）**
\`\`\`sql
-- 记录迁移前状态
CREATE TABLE migration_baseline AS
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT id) as unique_ids,
  SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) as non_null_email,
  MD5(STRING_AGG(id::text, ',' ORDER BY id)) as row_checksum
FROM users;
\`\`\`

**② 迁移后验证（Post-Migration）**
\`\`\`sql
-- 行数对比
SELECT
  (SELECT COUNT(*) FROM users) as after_count,
  (SELECT total_rows FROM migration_baseline) as before_count,
  (SELECT COUNT(*) FROM users) - (SELECT total_rows FROM migration_baseline) as diff;

-- 关键字段空值检查
SELECT COUNT(*) as null_names FROM users WHERE name IS NULL;
SELECT COUNT(*) as null_emails FROM users WHERE email IS NULL;

-- 数据一致性抽样（对比10%数据）
SELECT u.id, u.name, b.username
FROM users u
JOIN users_backup b ON u.id = b.id
WHERE u.name != b.username
LIMIT 100;
\`\`\`

**③ 业务验证（Smoke Test）**
\`\`\`bash
# 验证核心业务接口
curl -X POST /api/auth/login -d '{"email":"test@example.com","password":"xxx"}'
curl -X GET /api/users/1
curl -X POST /api/orders -d '{"userId":1,"items":[...]}'
\`\`\`

**验证通过标准**
- [ ] 行数差异为 0（或符合预期的新增/删除）
- [ ] 关键字段 NULL 率为 0
- [ ] 数据抽样一致性 100%
- [ ] Smoke Test 全部通过
- [ ] 数据库慢查询无异常增加

**输出**：验证脚本套件 + 通过标准 Checklist`,
    },
    {
      title: '4. 回滚方案',
      content: `制定多层次回滚机制，确保任何阶段都可以安全撤退：

**三级回滚策略**

**Level 1：脚本级回滚（最快，< 5 分钟）**
\`\`\`bash
# 直接执行 DOWN 脚本
npx knex migrate:down
# 或
flyway undo
\`\`\`
适用条件：迁移后立即发现问题，数据量小

**Level 2：备份恢复（中速，5-30 分钟）**
\`\`\`bash
# 迁移前创建备份（必须！）
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --table=users \
  -f backup_users_$(date +%Y%m%d_%H%M%S).sql

# 恢复
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_users_20240115_020000.sql
\`\`\`

**Level 3：蓝绿数据库（最可靠，但成本高）**
\`\`\`
Green DB（新）→ 迁移成功 → 流量切到 Green
Blue DB（旧）→ 保留 72 小时 → 确认无问题后关闭
\`\`\`

**回滚决策树**
\`\`\`
迁移执行中...
├── 数据验证失败？
│   └── YES → 立即执行 Level 1 回滚（DOWN 脚本）
├── 业务 Smoke Test 失败？
│   └── YES → Level 1 回滚 → 分析根因
└── 迁移后 24 小时内发现数据异常？
    └── YES → Level 2 回滚（备份恢复）→ 通知用户
\`\`\`

**输出**：多级回滚方案 + 回滚决策树 + 备份命令`,
    },
    {
      title: '5. 零停机迁移四步法',
      content: `对于无法停机的生产系统，使用"扩列→双写→切流→清旧"四步法：

**背景**：将 \`username\` 列重命名为 \`name\`，同时新增 \`email\` 列

**Step 1：扩列（向后兼容）**
\`\`\`sql
-- 新增 name 和 email 列，保留 username（双列共存）
ALTER TABLE users ADD COLUMN name VARCHAR(100);
ALTER TABLE users ADD COLUMN email VARCHAR(255);
-- 应用代码：只读 username，不写 name（暂不变更代码）
\`\`\`

**Step 2：双写 + 数据回填**
\`\`\`typescript
// 应用代码更新：同时写入 username 和 name
await db.users.update({
  where: { id },
  data: {
    username: newName, // 旧列
    name: newName,     // 新列（同步写入）
    email: email,
  },
});

// 异步回填历史数据（后台任务，不影响主流程）
async function backfillNames() {
  let cursor = 0;
  while (true) {
    const rows = await db.users.findMany({
      where: { name: null },
      take: 1000,
    });
    if (rows.length === 0) break;
    await db.users.updateMany({
      where: { id: { in: rows.map(r => r.id) } },
      data: rows.map(r => ({ name: r.username })),
    });
  }
}
\`\`\`

**Step 3：切流（读取切换到新列）**
\`\`\`typescript
// 确认回填完成后，切换读取源
// 应用代码：读 name，写 name（不再写 username）
const user = await db.users.findUnique({
  select: { id: true, name: true, email: true }, // 不再 select username
});
\`\`\`

**Step 4：清旧（移除废弃列）**
\`\`\`sql
-- 确认应用代码已完全切换（观察 1-2 周）
ALTER TABLE users DROP COLUMN username;
-- 观察指标：慢查询、错误日志中是否有 username 相关错误
\`\`\`

**关键时间线**
\`\`\`
Day 0: Step 1（扩列）→ 部署新版本（双写）
Day 1: Step 2（确认双写正常，后台回填完成）
Day 3: Step 3（切换读取到新列）→ 部署
Day 14: Step 4（确认无问题，删除旧列）
\`\`\`

**输出**：零停机迁移四步代码示例 + 时间线 + 监控指标`,
    },
  ],
  outputFormat: '迁移评估报告 + UP/DOWN 迁移脚本 + 数据验证 SQL 套件 + 多级回滚方案 + 零停机迁移四步代码示例',
  examples: [],
  notes: [
    '数据迁移前必须备份，无论多紧急。备份是回滚的最后防线',
    '分批处理大表（BATCH_SIZE = 1000-5000），避免长事务和表锁',
    '生产迁移应先在测试环境全流程演练，记录实际耗时',
    '零停机迁移每个步骤之间至少观察 24 小时，确认监控指标正常再进行下一步',
    'DROP COLUMN 是不可逆操作，在确认切换完成前绝对不要执行',
  ],
  category: '执行侧',
  nextSkill: 'database-optimize',
};
