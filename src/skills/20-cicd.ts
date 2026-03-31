import type { SkillDefinition } from './types';

export const cicdSkill: SkillDefinition = {
  id: 'cicd',
  name: 'CI/CD 流水线',
  nameEn: 'cicd',
  order: 20,
  category: '执行侧',
  description: '设计完整 CI/CD 流水线，涵盖流水线阶段设计、测试自动化、部署门控和回滚策略',
  descriptionEn: 'Design complete CI/CD pipelines covering stage design, test automation, deployment gates, and rollback triggers',
  detailDescription: `端到端 CI/CD 流水线设计指导，从流水线阶段规划、构建优化、测试自动化分层，
到部署策略（蓝绿/金丝雀）、部署门控配置和自动回滚机制，帮助团队建立快速、安全的持续交付体系。`,
  triggers: [
    'CI/CD',
    'cicd',
    '流水线',
    'pipeline',
    '持续集成',
    'continuous integration',
    '持续部署',
    'continuous deployment',
    '自动化部署',
    'automated deployment',
    'GitHub Actions',
    '构建优化',
    '@ethan cicd',
    '@ethan ci',
  ],
  steps: [
    {
      title: '1. 流水线阶段设计',
      content: `**标准 CI/CD 流水线结构**

\`\`\`
Push/PR → [CI 阶段] → [镜像构建] → [部署到 Staging] → [部署到 Production]

CI 阶段（每次 Push/PR 触发）:
  ├── 代码检查: Lint + Type Check
  ├── 单元测试: Unit Tests + Coverage
  ├── 安全扫描: SAST + Dependency Audit
  └── 构建验证: Build Success Check

镜像构建（CI 通过后）:
  ├── Docker Build（多平台）
  ├── 镜像安全扫描（Trivy）
  └── 推送到 Registry（打 tag）

部署流程:
  ├── Staging（自动，合并到 main 后）
  │   ├── 集成测试
  │   └── E2E 测试（冒烟）
  └── Production（需审批 or 手动触发）
      ├── 部署策略（蓝绿/金丝雀）
      └── 部署后验证（健康检查）
\`\`\`

**快速反馈原则**
- CI 总时长目标：< 10 分钟（开发者等待阈值）
- 测试并行化：单元测试 → 集成测试 → E2E（分层执行）
- Fail Fast：代码格式错误最先检查，最快发现`,
    },
    {
      title: '2. GitHub Actions 流水线配置',
      content: `**完整 CI 工作流示例**
\`\`\`yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  # ─── 代码质量检查 ───────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  # ─── 测试 ────────────────────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test -- --coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: \${{ secrets.CODECOV_TOKEN }}

  # ─── 安全扫描 ───────────────────────────────────
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3

  # ─── 构建镜像 ───────────────────────────────────
  build:
    name: Build & Push Image
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: \${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
\`\`\``,
    },
    {
      title: '3. 构建速度优化',
      content: `**缓存策略**
\`\`\`yaml
# npm/yarn 依赖缓存
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: \${{ runner.os }}-node-\${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      \${{ runner.os }}-node-

# Docker layer 缓存（使用 GitHub Actions Cache）
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
\`\`\`

**并行执行策略**
\`\`\`yaml
# 使用 matrix 并行运行测试
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]     # 4个并行 runner
    steps:
      - run: npm test -- --shard=\${{ matrix.shard }}/4
\`\`\`

**跳过不必要的 CI**
\`\`\`yaml
# 路径过滤：文档变更不触发完整 CI
on:
  push:
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - '.github/ISSUE_TEMPLATE/**'

# 或者使用 paths 只触发相关路径
on:
  push:
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package*.json'
\`\`\`

**Self-hosted Runner（节省 CI 费用）**
\`\`\`
适用场景: 大型项目、私有依赖、特殊硬件需求
注意事项:
- 安全隔离（不要在 public repo 使用 self-hosted runner）
- 定期更新 runner 软件
- 隔离不同项目的 runner（避免环境污染）
\`\`\``,
    },
    {
      title: '4. 部署策略与门控',
      content: `**三种主要部署策略**

**蓝绿部署（Blue-Green）**
\`\`\`
适用: 需要零停机、可快速回滚的场景
成本: 双倍资源（同时运行两套环境）

Blue（当前生产）: v1.0 → 接收所有流量
Green（新版本）:  v1.1 → 部署验证中
切换: 负载均衡器流量从 Blue → Green（瞬间完成）
回滚: 流量切回 Blue（秒级）
\`\`\`

**金丝雀部署（Canary Release）**
\`\`\`
适用: 高风险变更、需要渐进式验证
流程:
  1%流量 → 新版本（观察5min）
  → 10%（观察15min）
  → 50%（观察30min）
  → 100%（全量）

Kubernetes 实现:
kubectl scale deployment app-v2 --replicas=1   # 1/10 = 10%
kubectl scale deployment app-v1 --replicas=9
\`\`\`

**部署门控（Deployment Gates）配置**
\`\`\`yaml
# GitHub Environments 配置审批
deploy-production:
  environment:
    name: production
    url: https://app.example.com
  # 需要人工审批
  steps:
    - name: Request approval
      uses: trstringer/manual-approval@v1
      with:
        approvers: team-lead,cto
        minimum-approvals: 1

# 自动门控：基于健康检查
deploy-production:
  steps:
    - name: Deploy
      run: kubectl apply -f k8s/
    - name: Wait for rollout
      run: kubectl rollout status deployment/app --timeout=5m
    - name: Smoke test
      run: |
        sleep 10
        curl -f https://api.example.com/health || exit 1
\`\`\``,
    },
    {
      title: '5. 回滚策略与监控告警',
      content: `**自动回滚触发条件**
\`\`\`yaml
# 部署后自动验证，失败则回滚
steps:
  - name: Deploy to production
    id: deploy
    run: kubectl set image deployment/app app=\${{ env.NEW_IMAGE }}

  - name: Monitor deployment health
    run: |
      # 等待10分钟，监控错误率
      for i in {1..20}; do
        ERROR_RATE=$(curl -s https://metrics.example.com/api/error-rate)
        if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
          echo "Error rate $ERROR_RATE% exceeds threshold, rolling back!"
          kubectl rollout undo deployment/app
          exit 1
        fi
        sleep 30
      done

  - name: Rollback on failure
    if: failure() && steps.deploy.outcome == 'success'
    run: kubectl rollout undo deployment/app
\`\`\`

**Kubernetes 滚动更新配置**
\`\`\`yaml
# deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 最多多启动1个 Pod
      maxUnavailable: 0    # 始终保持满负载（零停机）
  minReadySeconds: 30      # Pod 就绪后等待30s再继续
\`\`\`

**部署通知**
\`\`\`yaml
# 部署成功/失败通知到 Slack
- name: Notify deployment status
  uses: slackapi/slack-github-action@v1
  with:
    channel-id: 'deployments'
    slack-message: |
      \${{ job.status == 'success' && '✅' || '❌' }} Deployment to Production
      Version: \${{ github.sha }}
      Actor: \${{ github.actor }}
      Status: \${{ job.status }}
  env:
    SLACK_BOT_TOKEN: \${{ secrets.SLACK_BOT_TOKEN }}
\`\`\`

**关键 CI/CD 指标**

| 指标 | 目标 | 说明 |
|------|------|------|
| Lead Time | < 1天 | 代码到生产的时间 |
| Deploy Frequency | 每日1次+ | 部署频率 |
| MTTR | < 1小时 | 故障恢复时间 |
| Change Failure Rate | < 15% | 部署导致故障比例 |`,
    },
  ],
  outputFormat:
    'Markdown CI/CD 方案文档，含流水线阶段图、GitHub Actions YAML 配置、部署策略对比和回滚方案',
  examples: [
    {
      input: '帮我设计一个 Node.js 项目的 GitHub Actions CI/CD 流水线',
      output: `## CI/CD 流水线方案

**流程**: PR → CI（lint + test + security）→ 合并 main → 构建镜像 → 部署 Staging → 人工审批 → 部署 Production

**关键配置**:
- 使用 npm cache + Docker layer cache，目标 CI 时间 < 8 分钟
- Production 部署需 team-lead 审批（GitHub Environment protection rules）
- 部署后自动运行健康检查，失败自动 kubectl rollout undo
- Slack 通知部署结果`,
    },
  ],
  notes: [
    '流水线应该是可靠的，不稳定的 CI 比没有 CI 更糟糕（影响信任度）',
    '保护 main 分支，禁止直接推送，所有变更必须经过 PR + CI 验证',
    '密钥统一用 GitHub Secrets / Vault 管理，严禁硬编码在配置文件中',
    '定期检查并更新 CI Actions 版本，避免使用废弃的 Action 版本',
  ],
  nextSkill: 'performance',
};
