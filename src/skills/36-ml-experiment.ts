import type { SkillDefinition } from './types';

export const mlExperimentSkill: SkillDefinition = {
  id: 'ml-experiment',
  name: 'ML 实验管理',
  nameEn: 'ml_experiment',
  order: 36,
  description: '规范 ML 实验设计、追踪配置（MLflow/W&B）、数据版本控制、Model Card 生成与部署监控',
  descriptionEn: 'Standardize ML experiment design, tracking config (MLflow/W&B), data versioning, Model Card generation and deployment monitoring',
  detailDescription: `ML 项目最大的痛点是"不可复现"——换台机器、换个版本就跑不出相同结果。
本 Skill 建立系统化的 ML 工程规范：从假设驱动的实验设计，
到 MLflow/W&B 实验追踪配置，再到 DVC 数据版本控制和特征工程复现，
生成标准化的 Model Card，最终覆盖模型注册、A/B 上线、数据漂移监控和自动回滚，
让 ML 实验从"炼丹"变为"可控的工程实践"。`,
  triggers: [
    'ml experiment',
    'mlops',
    'model training',
    '模型训练',
    '实验追踪',
    'model card',
    'mlflow',
    'wandb',
    'dvc',
    '机器学习实验',
    '@ethan ml-experiment',
    '/ml-experiment',
  ],
  steps: [
    {
      title: '1. 实验设计',
      content: `在开始训练前明确实验目标和控制变量：

**假设驱动实验设计**
\`\`\`markdown
## 实验设计文档

### 研究问题
我们假设：[变量 X] 会导致 [指标 Y] 提升 [Z%]，
因为 [理论依据或先验知识]。

### 实验配置
- 控制组（Baseline）：[现有模型/方法描述]
- 实验组：[变更内容描述]
- 控制变量：[保持不变的因素：数据集/超参/随机种子]

### 评估指标
- 主要指标：AUC-ROC（因为关注排序，不关注具体阈值）
- 次要指标：Precision@K, Recall@K
- 业务指标：CTR 提升（线上 A/B 验证）

### 成功标准
- 主要指标提升 ≥ 2%（统计显著性 p < 0.05）
- 推理延迟不增加超过 20%
- 训练成本不超过 $50
\`\`\`

**实验矩阵（超参搜索）**
\`\`\`python
# 使用 Optuna 自动超参优化
import optuna

def objective(trial):
    params = {
        'learning_rate': trial.suggest_float('lr', 1e-5, 1e-1, log=True),
        'batch_size': trial.suggest_categorical('batch_size', [16, 32, 64, 128]),
        'dropout': trial.suggest_float('dropout', 0.1, 0.5),
        'hidden_dim': trial.suggest_int('hidden_dim', 64, 512, step=64),
    }
    model = train_model(**params)
    return evaluate(model)['auc']

study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=50, timeout=3600)
print(f"Best params: {study.best_params}")
\`\`\`

**最小可行实验（MVE）原则**
\`\`\`
先用 10% 数据快速验证假设（10min 训练）
→ 有提升信号 → 扩展到全量数据
→ 无提升信号 → 调整假设重新实验
\`\`\`

**输出**：实验设计文档 + 评估指标定义 + 超参搜索配置`,
    },
    {
      title: '2. 实验追踪配置',
      content: `配置 MLflow 或 W&B 实现实验全自动追踪：

**MLflow 完整配置**
\`\`\`python
import mlflow
import mlflow.pytorch

# 配置追踪服务器
mlflow.set_tracking_uri("http://mlflow-server:5000")
mlflow.set_experiment("recommendation-model-v2")

with mlflow.start_run(run_name="bert-finetune-lr1e-4") as run:
    # 记录所有超参
    mlflow.log_params({
        "model_name": "bert-base-chinese",
        "learning_rate": 1e-4,
        "batch_size": 32,
        "epochs": 10,
        "optimizer": "AdamW",
        "warmup_steps": 500,
    })

    # 记录数据集信息
    mlflow.log_param("train_samples", len(train_dataset))
    mlflow.log_param("data_version", "v2024-01-15")

    for epoch in range(config.epochs):
        train_loss = train_epoch(model, train_loader)
        val_metrics = evaluate(model, val_loader)

        # 实时记录指标
        mlflow.log_metrics({
            "train_loss": train_loss,
            "val_loss": val_metrics['loss'],
            "val_auc": val_metrics['auc'],
            "val_f1": val_metrics['f1'],
        }, step=epoch)

    # 注册最终模型
    mlflow.pytorch.log_model(
        model,
        "model",
        registered_model_name="recommendation-model",
        pip_requirements=["torch==2.1.0", "transformers==4.35.0"],
    )

    # 记录评估报告
    mlflow.log_artifact("reports/confusion_matrix.png")
    mlflow.log_artifact("reports/feature_importance.html")

print(f"Run ID: {run.info.run_id}")
\`\`\`

**W&B 配置（更丰富的可视化）**
\`\`\`python
import wandb

wandb.init(
    project="recommendation-v2",
    name="bert-finetune-lr1e-4",
    config={
        "learning_rate": 1e-4,
        "architecture": "bert-base",
        "dataset": "user-clicks-v2",
    },
    tags=["bert", "production-candidate"],
)

# 自动记录梯度和权重（PyTorch）
wandb.watch(model, log='all', log_freq=100)

# 训练循环中
wandb.log({"train_loss": loss, "val_auc": auc}, step=epoch)

# 完成时
wandb.finish()
\`\`\`

**输出**：MLflow/W&B 实验追踪配置 + 训练脚本模板`,
    },
    {
      title: '3. 数据版本控制',
      content: `使用 DVC 管理数据集和特征工程的版本：

**DVC 初始化与数据版本管理**
\`\`\`bash
# 初始化 DVC（与 Git 协同）
git init && dvc init

# 添加数据集到 DVC 管理
dvc add data/train.parquet
dvc add data/test.parquet
git add data/.gitignore data/train.parquet.dvc data/test.parquet.dvc
git commit -m "Add training data v1"

# 配置远程存储（S3/GCS/Azure）
dvc remote add -d myremote s3://my-ml-bucket/dvc-store
dvc push  # 上传数据到远程

# 切换到不同数据版本
git checkout v1.0-data-tag
dvc pull  # 下载对应版本数据
\`\`\`

**特征工程管道（可复现）**
\`\`\`python
# dvc.yaml — 定义可复现的管道
stages:
  prepare_data:
    cmd: python src/prepare.py --input data/raw --output data/prepared
    deps:
      - src/prepare.py
      - data/raw
    outs:
      - data/prepared

  feature_engineering:
    cmd: python src/features.py --input data/prepared --output data/features
    deps:
      - src/features.py
      - data/prepared
      - params.yaml          # 特征工程超参
    outs:
      - data/features
    metrics:
      - reports/feature_stats.json

  train:
    cmd: python src/train.py
    deps:
      - src/train.py
      - data/features
    outs:
      - models/model.pkl
    metrics:
      - reports/metrics.json
\`\`\`

\`\`\`bash
# 运行完整管道（只重新执行有变化的阶段）
dvc repro

# 对比不同版本的指标
dvc metrics diff v1.0 v2.0
# ┌──────────────┬───────┬───────┬────────┐
# │ Metric       │ HEAD  │ v1.0  │ Change │
# ├──────────────┼───────┼───────┼────────┤
# │ val_auc      │ 0.847 │ 0.831 │ +0.016 │
# └──────────────┴───────┴───────┴────────┘
\`\`\`

**输出**：DVC 配置 + 特征管道 dvc.yaml + 版本对比命令`,
    },
    {
      title: '4. Model Card 生成',
      content: `为每个发布的模型生成标准化的 Model Card：

**Model Card 模板**
\`\`\`markdown
# Model Card: 推荐模型 v2.1.0

## 模型概述
- **模型类型**：双塔召回模型（BERT + 协同过滤）
- **任务**：电商商品推荐
- **训练日期**：2024-01-20
- **版本**：v2.1.0
- **MLflow Run ID**：abc123def456

## 预期用途
### 主要用途
为已登录用户生成个性化商品推荐，覆盖首页、详情页猜你喜欢。

### 不适合的用途
- 冷启动用户（注册 < 7 天）→ 使用热门推荐替代
- 价格敏感决策（不提供价格预测）

## 训练数据
- **数据集**：user-click-events v2024-01
- **训练样本**：5,200,000 条用户点击行为
- **时间范围**：2023-07-01 ～ 2023-12-31
- **数据版本**：DVC tag \`data-v2024-01\`

## 性能指标
| 指标 | 离线值 | 在线 A/B（1周） |
|------|--------|---------------|
| Recall@20 | 0.847 | 0.821 |
| NDCG@20 | 0.623 | 0.598 |
| CTR | — | +4.2%（vs 旧模型）|
| Latency P99 | 45ms | 52ms |

## 偏差与公平性
- 对新品（上架 < 30 天）存在曝光不足偏差 → 已通过 Explore 策略缓解
- 价格区间分布分析：低价商品点击率被高估（训练集偏差）→ 已加权修正

## 限制
- 模型不包含实时库存信息，需上层过滤下架商品
- 不支持多语言商品（仅中文描述）

## 负责任的 AI 声明
- 不使用性别/年龄等受保护属性作为特征
- 符合公司隐私政策，用户行为数据已脱敏处理
\`\`\`

**自动生成脚本**
\`\`\`python
def generate_model_card(run_id: str, ab_results: dict) -> str:
    """从 MLflow run 自动生成 Model Card"""
    run = mlflow.get_run(run_id)
    params = run.data.params
    metrics = run.data.metrics

    return MODEL_CARD_TEMPLATE.format(
        version=params.get('model_version'),
        train_date=run.info.start_time,
        recall_at_20=metrics.get('val_recall_at_20'),
        ctr_lift=ab_results.get('ctr_lift'),
        run_id=run_id,
    )
\`\`\`

**输出**：Model Card 文档 + 自动生成脚本`,
    },
    {
      title: '5. 部署与监控',
      content: `模型上线、A/B 测试和生产监控完整方案：

**模型注册与晋升流程**
\`\`\`python
# MLflow 模型注册与阶段管理
from mlflow.tracking import MlflowClient

client = MlflowClient()

# 注册模型
model_uri = f"runs:/{run_id}/model"
mv = client.create_model_version(
    name="recommendation-model",
    source=model_uri,
    run_id=run_id,
)

# 模型阶段：None → Staging → Production
# 先晋升到 Staging（测试）
client.transition_model_version_stage(
    name="recommendation-model",
    version=mv.version,
    stage="Staging",
)

# 验证通过后晋升到 Production
client.transition_model_version_stage(
    name="recommendation-model",
    version=mv.version,
    stage="Production",
    archive_existing_versions=True,  # 归档旧版本
)
\`\`\`

**A/B 测试配置**
\`\`\`python
# 按用户哈希分流
def get_model_for_user(user_id: str) -> str:
    hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
    if hash_val < 10:  # 10% 流量
        return "recommendation-model:v2.1.0"
    else:
        return "recommendation-model:v2.0.0"

# 记录 A/B 分组（用于统计分析）
mlflow.log_param("ab_group", "control" if version == "v2.0.0" else "treatment")
\`\`\`

**数据漂移监控（Evidently）**
\`\`\`python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset, ModelPerformancePreset

# 对比训练数据分布 vs 生产数据分布
report = Report(metrics=[
    DataDriftPreset(),           # 特征分布漂移
    ModelPerformancePreset(),    # 模型性能漂移
])

report.run(reference_data=train_df, current_data=production_df_last_7d)
report.save_html("reports/drift_report.html")

# 自动回滚条件
drift_detected = report.as_dict()['metrics'][0]['result']['dataset_drift']
if drift_detected:
    alert_and_rollback(reason="Feature distribution drift detected")
\`\`\`

**生产监控仪表盘**
\`\`\`
关键指标（每日监控）：
─────────────────────────────────
模型性能：
  在线 CTR（实验 vs 对照）
  推荐命中率（Recall@K）

数据漂移：
  用户特征分布变化（PSI > 0.2 告警）
  商品特征新增/消失比率

运维指标：
  推理延迟 P99（< 100ms）
  模型服务错误率（< 0.1%）
  预测请求量（异常波动告警）
\`\`\`

**输出**：模型注册流程 + A/B 测试配置 + 漂移监控脚本 + 自动回滚方案`,
    },
  ],
  outputFormat: '实验设计文档 + MLflow/W&B 追踪配置 + DVC 数据管道 + Model Card + 部署 A/B 测试方案 + 漂移监控配置',
  examples: [],
  notes: [
    '实验追踪不是可选项——没有追踪记录的实验结果无法复现，也无法与团队分享',
    '每个 MLflow/W&B Run 必须记录数据版本，否则6个月后无法知道用了哪份训练数据',
    'Model Card 对外部合作和监管合规至关重要，建议与模型一起版本化管理',
    '数据漂移监控比模型指标监控更重要——漂移发生在指标下降之前',
    '优先用 MLflow（开源自托管）降低工具成本；大团队再考虑 W&B 或 Vertex AI 等商业方案',
  ],
  category: '执行侧',
  nextSkill: 'data-pipeline',
};
