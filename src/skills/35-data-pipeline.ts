import type { SkillDefinition } from './types';

export const dataPipelineSkill: SkillDefinition = {
  id: 'data-pipeline',
  name: '数据管道设计',
  nameEn: 'data_pipeline',
  order: 35,
  description: '设计 Batch/Streaming 数据管道，制定数据质量规则、容错策略与血缘追踪方案',
  descriptionEn: 'Design Batch/Streaming data pipelines with data quality rules, fault tolerance strategies and lineage tracking',
  detailDescription: `数据管道是数据驱动业务的基础设施，但设计不当会导致数据丢失、重复和质量下降。
本 Skill 覆盖数据管道设计全流程：从 Batch/Streaming/Lambda/Kappa 架构选型，
到数据质量规则（完整性/准确性/及时性），再到幂等容错、死信队列和断点续传设计，
最终建立数据血缘（Data Lineage）和可观测性体系，让数据流动可靠、可追溯。`,
  triggers: [
    '数据管道',
    'data pipeline',
    'etl',
    'elt',
    'data engineering',
    '数据工程',
    'airflow',
    'kafka pipeline',
    'streaming pipeline',
    '@ethan data-pipeline',
    '/data-pipeline',
  ],
  steps: [
    {
      title: '1. 架构选型',
      content: `根据数据特征和业务需求选择合适的管道架构：

**四大架构模式决策矩阵**

| 架构 | 延迟 | 复杂度 | 适用场景 | 代表工具 |
|------|------|--------|---------|---------|
| **Batch（批处理）** | 小时~天 | 低 | 日报、数据仓库 ETL、离线训练 | Airflow + Spark |
| **Streaming（流处理）** | 秒~毫秒 | 高 | 实时监控、欺诈检测、事件驱动 | Kafka + Flink |
| **Lambda（λ）** | 两套 | 极高 | 需要批量精确性+流式时效性 | Kafka + Spark + Hive |
| **Kappa（κ）** | 秒 | 中 | 一切皆流，重播历史数据 | Kafka + Flink |

**决策树**
\`\`\`
数据新鲜度要求 < 1分钟？
├── YES → Streaming（Kafka + Flink）
└── NO
    └── 需要精确的历史重算？
        ├── YES + 实时结果 → Lambda 架构
        ├── YES + 可接受重播 → Kappa 架构
        └── NO → Batch（Airflow + Spark/dbt）
\`\`\`

**Source → Transform → Sink 数据流图**
\`\`\`
数据源（Sources）:
  MySQL / PostgreSQL（CDC）
  Kafka Topics
  REST API / Webhook
  文件系统（S3/GCS）
         │
         ▼
变换层（Transform）:
  数据清洗（去重/标准化/脱敏）
  业务逻辑计算
  聚合/Join
         │
         ▼
目标层（Sinks）:
  数据仓库（BigQuery/Snowflake/Redshift）
  数据湖（S3/GCS Parquet）
  搜索引擎（Elasticsearch）
  特征存储（Feature Store）
\`\`\`

**技术栈推荐**
\`\`\`
小团队/初创：
  Airflow + dbt + BigQuery（低运维成本）

中大型团队：
  Kafka + Flink + Iceberg + Trino（高吞吐实时）

全托管方案：
  Fivetran（Ingestion）+ dbt Cloud（Transform）+ Snowflake（Warehouse）
\`\`\`

**输出**：架构选型报告 + 数据流图`,
    },
    {
      title: '2. 数据质量规则',
      content: `定义并实施数据质量检查规则：

**数据质量四维度**

| 维度 | 定义 | 检查方式 | 阈值示例 |
|------|------|---------|---------|
| **完整性** | 必填字段不为空 | NULL 率检查 | < 0.1% |
| **准确性** | 值在合理范围内 | 范围/格式校验 | 异常值率 < 1% |
| **一致性** | 跨系统数据一致 | 对账/交叉校验 | 差异率 < 0.01% |
| **及时性** | 数据按时到达 | 延迟监控 | 最大延迟 < 2h |

**dbt 数据质量测试（推荐）**
\`\`\`yaml
# models/orders.yml
version: 2
models:
  - name: orders
    columns:
      - name: order_id
        tests:
          - not_null
          - unique
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('users')
              field: id
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'paid', 'shipped', 'completed', 'cancelled']
      - name: amount
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 1000000
\`\`\`

**Great Expectations 数据期望（Python）**
\`\`\`python
import great_expectations as gx

context = gx.get_context()
suite = context.add_expectation_suite("orders_suite")

# 定义数据期望
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(column="order_id")
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="amount", min_value=0, max_value=1_000_000
    )
)
suite.add_expectation(
    gx.expectations.ExpectTableRowCountToBeBetween(
        min_value=1000,  # 每日订单不少于1000
        max_value=1_000_000
    )
)

# 运行验证
result = context.run_checkpoint("daily_orders_checkpoint")
if not result.success:
    raise DataQualityError("数据质量检查未通过！")
\`\`\`

**数据质量告警**
\`\`\`yaml
# 数据质量 SLA
- NULL 率超过 1%：🔴 阻断管道，Slack 告警
- 行数下降 > 20%（对比昨日）：🟠 告警，人工核查
- P99 延迟 > 2 小时：🟡 警告，关注
\`\`\`

**输出**：数据质量规则文档 + dbt/GE 测试配置`,
    },
    {
      title: '3. 管道设计与代码模板',
      content: `生成可复用的管道代码模板：

**Airflow DAG 模板（Batch）**
\`\`\`python
# dags/daily_orders_etl.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from datetime import datetime, timedelta

default_args = {
    'owner': 'data-team',
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'on_failure_callback': alert_slack,
}

with DAG(
    'daily_orders_etl',
    default_args=default_args,
    schedule_interval='0 2 * * *',  # 每日凌晨2点
    start_date=datetime(2024, 1, 1),
    catchup=False,  # 不回填历史
    tags=['orders', 'daily'],
) as dag:

    extract = PythonOperator(task_id='extract', python_callable=extract_orders)
    validate = PythonOperator(task_id='validate', python_callable=run_quality_checks)
    transform = PythonOperator(task_id='transform', python_callable=transform_orders)
    load = PythonOperator(task_id='load', python_callable=load_to_warehouse)
    notify = PythonOperator(task_id='notify', python_callable=send_completion_report)

    extract >> validate >> transform >> load >> notify
\`\`\`

**Kafka + Flink 流处理模板**
\`\`\`python
# Flink Python API
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaSource, KafkaSink

env = StreamExecutionEnvironment.get_execution_environment()
env.set_parallelism(4)

# Source
kafka_source = KafkaSource.builder() \
    .set_bootstrap_servers("kafka:9092") \
    .set_topics("orders") \
    .set_group_id("flink-order-processor") \
    .set_value_only_deserializer(JsonRowDeserializationSchema()) \
    .build()

stream = env.from_source(kafka_source, WatermarkStrategy.no_watermarks(), "Kafka Source")

# Transform（滚动窗口：每分钟统计）
result = stream \
    .key_by(lambda x: x['region']) \
    .window(TumblingEventTimeWindows.of(Time.minutes(1))) \
    .aggregate(OrderAggregateFunction())

# Sink
result.sink_to(KafkaSink.builder()
    .set_bootstrap_servers("kafka:9092")
    .set_record_serializer(JsonRowSerializationSchema())
    .build())

env.execute("Order Stream Processing")
\`\`\`

**输出**：Airflow DAG 模板 + Flink/Spark 流处理模板`,
    },
    {
      title: '4. 容错与重试策略',
      content: `确保管道在故障时可靠恢复：

**核心容错原则**

**① 幂等性设计（最重要）**
\`\`\`python
def load_orders_idempotent(batch_date: str, orders: list):
    """幂等加载：同一批次多次执行结果相同"""
    # 使用 INSERT ... ON CONFLICT DO NOTHING
    # 或 MERGE（UPSERT）语义
    pg_hook.run("""
        INSERT INTO orders_dw (order_id, batch_date, amount, status)
        VALUES %s
        ON CONFLICT (order_id) DO UPDATE SET
          amount = EXCLUDED.amount,
          status = EXCLUDED.status,
          updated_at = NOW()
    """, [(o['id'], batch_date, o['amount'], o['status']) for o in orders])
\`\`\`

**② 死信队列（DLQ）**
\`\`\`python
# Kafka — 处理失败消息路由到 DLQ
def process_message(msg):
    try:
        transform_and_load(msg)
    except Exception as e:
        # 路由到死信队列，保留原始消息 + 错误信息
        dlq_producer.send('orders-dlq', {
            'original_message': msg,
            'error': str(e),
            'failed_at': datetime.utcnow().isoformat(),
            'retry_count': msg.get('retry_count', 0) + 1
        })
        logger.error(f"Message sent to DLQ: {e}")
\`\`\`

**③ 断点续传（Checkpoint）**
\`\`\`python
def process_large_dataset():
    checkpoint_file = '.etl_checkpoint'
    last_id = load_checkpoint(checkpoint_file)

    for batch in fetch_in_batches(after_id=last_id, batch_size=1000):
        process_batch(batch)
        save_checkpoint(checkpoint_file, batch[-1]['id'])  # 每批保存进度
\`\`\`

**④ 指数退避重试**
\`\`\`python
import tenacity

@tenacity.retry(
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=60),
    stop=tenacity.stop_after_attempt(5),
    retry=tenacity.retry_if_exception_type(TransientError),
    before_sleep=tenacity.before_sleep_log(logger, logging.WARNING)
)
def call_external_api(data):
    return requests.post(API_URL, json=data, timeout=30)
\`\`\`

**输出**：容错策略文档 + 幂等加载模板 + DLQ 配置`,
    },
    {
      title: '5. 数据血缘与可观测性',
      content: `建立数据血缘追踪和管道监控体系：

**数据血缘（Data Lineage）**
\`\`\`python
# OpenLineage 标准（Marquez/Atlan/DataHub 支持）
from openlineage.client import OpenLineageClient
from openlineage.client.run import RunEvent, Job, Run, Dataset

client = OpenLineageClient.from_environment()

# 记录数据流转关系
client.emit(RunEvent(
    eventType="COMPLETE",
    job=Job(namespace="etl", name="daily_orders_transform"),
    run=Run(runId=str(uuid4())),
    inputs=[Dataset(namespace="postgres", name="raw_orders")],
    outputs=[Dataset(namespace="bigquery", name="orders_dw.fact_orders")]
))
\`\`\`

**管道健康仪表盘指标**
\`\`\`
关键指标（Grafana 面板）：
─────────────────────────────
延迟指标：
  - 数据新鲜度（最新记录时间戳）
  - Pipeline P95 执行时长
  - Kafka Consumer Lag

质量指标：
  - 每日 NULL 率趋势
  - 行数异常检测（±30% 告警）
  - 数据质量测试通过率

运维指标：
  - 管道成功率（目标 > 99%）
  - 重试次数分布
  - DLQ 消息积压
\`\`\`

**Airflow SLA 监控**
\`\`\`python
with DAG(
    'daily_orders_etl',
    sla_miss_callback=sla_miss_alert,  # SLA 超时回调
    ...
) as dag:
    load_task = PythonOperator(
        task_id='load',
        python_callable=load_to_warehouse,
        sla=timedelta(hours=4),  # 必须在4小时内完成
    )
\`\`\`

**数据目录集成**
\`\`\`yaml
# dbt docs（自动生成）
# 运行后访问：dbt docs serve
# 包含：模型血缘图、列描述、测试结果

# 推荐工具
生产级：DataHub, Atlan, Alation
开源轻量：Marquez, OpenMetadata
dbt 生态：dbt docs + Elementary
\`\`\`

**输出**：数据血缘配置 + 监控仪表盘指标定义 + 数据目录方案`,
    },
  ],
  outputFormat: '架构选型文档 + 数据流图 + 质量规则配置（dbt/GE）+ 管道代码模板 + 容错策略 + 血缘追踪方案',
  examples: [],
  notes: [
    '幂等性是数据管道的第一原则——任何任务必须可以安全重试而不产生重复数据',
    '从 Batch 开始，在有真实需求时再迁移到 Streaming，避免过早的复杂度',
    '数据质量检查应与管道强耦合（而非事后补救），质量不达标应阻断下游加载',
    '死信队列不是垃圾桶——DLQ 中的消息代表业务异常，必须定期审查和处理',
    'dbt + Airflow + BigQuery 是目前最常见的现代数据栈，对大多数团队足够用',
  ],
  category: '执行侧',
  nextSkill: 'database-optimize',
};
