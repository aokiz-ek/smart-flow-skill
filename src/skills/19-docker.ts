import type { SkillDefinition } from './types';

export const dockerSkill: SkillDefinition = {
  id: 'docker',
  name: 'Docker 容器化',
  nameEn: 'docker',
  order: 19,
  category: '执行侧',
  description: '编写生产级 Dockerfile，实现多阶段构建、镜像优化和 docker-compose 编排',
  descriptionEn: 'Write production-grade Dockerfiles with multi-stage builds, image optimization, docker-compose orchestration, and security scanning',
  detailDescription: `系统指导 Docker 容器化实践，涵盖 Dockerfile 最佳实践、多阶段构建减小镜像体积、
镜像安全扫描、docker-compose 服务编排和容器运行时安全配置，帮助将应用安全高效地容器化。`,
  triggers: [
    'Docker',
    'docker',
    '容器化',
    'containerization',
    'Dockerfile',
    'dockerfile',
    'docker-compose',
    '镜像优化',
    'image optimization',
    '多阶段构建',
    'multi-stage build',
    '容器安全',
    '@ethan docker',
  ],
  steps: [
    {
      title: '1. Dockerfile 基础最佳实践',
      content: `**基础规则清单**

\`\`\`dockerfile
# ✅ 使用具体版本标签，避免 latest（不可复现）
FROM node:20.11-alpine3.19

# ✅ 设置工作目录（避免在根目录操作）
WORKDIR /app

# ✅ 先复制依赖文件，利用层缓存
# 依赖文件不变时，npm install 层直接复用缓存
COPY package*.json ./
RUN npm ci --only=production

# ✅ 再复制源码（源码改变不影响依赖缓存）
COPY . .

# ✅ 使用非 root 用户运行（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# ✅ 仅暴露必要端口
EXPOSE 3000

# ✅ 使用 ENTRYPOINT + CMD 组合（更灵活）
ENTRYPOINT ["node"]
CMD ["dist/index.js"]
\`\`\`

**层缓存优化原则**
\`\`\`
构建缓存命中规则：指令 + 参数 + 上下文文件 都相同才命中缓存

优化策略:
1. 变化频率低的指令放前面（基础镜像、系统依赖）
2. 变化频率高的指令放后面（应用代码）
3. 合并 RUN 指令减少层数

# ❌ 多个 RUN 产生多个层
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# ✅ 合并为一个 RUN，减少层数 + 及时清理缓存
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
\`\`\``,
    },
    {
      title: '2. 多阶段构建（Multi-Stage Build）',
      content: `多阶段构建将构建环境与运行环境分离，显著减小生产镜像体积：

**Node.js 应用示例**
\`\`\`dockerfile
# ===== Stage 1: Build =====
FROM node:20.11-alpine3.19 AS builder
WORKDIR /app

# 安装所有依赖（含 devDependencies）
COPY package*.json ./
RUN npm ci

# 编译 TypeScript
COPY . .
RUN npm run build

# ===== Stage 2: Dependencies =====
FROM node:20.11-alpine3.19 AS deps
WORKDIR /app
COPY package*.json ./
# 只安装生产依赖
RUN npm ci --only=production

# ===== Stage 3: Production =====
FROM node:20.11-alpine3.19 AS production
WORKDIR /app

# 只从前两个阶段复制必要文件
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 非 root 用户
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
\`\`\`

**效果对比**
\`\`\`
单阶段构建（含 devDeps + 源码）:  ~800 MB
多阶段构建（只含运行时）:          ~120 MB
体积减少约 85%
\`\`\`

**Go 应用（静态二进制最小镜像）**
\`\`\`dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# 使用 scratch（空镜像）或 distroless
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
# 最终镜像仅 ~10MB
\`\`\``,
    },
    {
      title: '3. .dockerignore 与镜像安全',
      content: `**配置 .dockerignore**
\`\`\`dockerignore
# 排除不需要的文件，减小构建上下文
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
*.md
.DS_Store
coverage/
dist/
.nyc_output
__tests__
*.test.ts
Dockerfile*
docker-compose*
\`\`\`

**镜像安全扫描**
\`\`\`bash
# Trivy（推荐，免费开源）
docker pull aquasec/trivy
trivy image --severity HIGH,CRITICAL myapp:latest

# 输出示例:
# CRITICAL: CVE-2024-xxxx in openssl 3.0.0 → 升级到 3.0.13

# 集成到 CI（GitHub Actions）
- name: Scan Docker image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'myapp:\${{ github.sha }}'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # 发现高危漏洞时 CI 失败
\`\`\`

**容器运行时安全配置**
\`\`\`bash
# 禁止 root 运行（Dockerfile 中已设置 USER，运行时再确认）
docker run --user 1001:1001 myapp:latest

# 只读文件系统（防止容器内写文件）
docker run --read-only --tmpfs /tmp myapp:latest

# 限制资源
docker run --memory="256m" --cpus="0.5" myapp:latest

# 丢弃不需要的 Linux Capabilities
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp:latest

# 禁止权限提升
docker run --security-opt no-new-privileges myapp:latest
\`\`\``,
    },
    {
      title: '4. Docker Compose 服务编排',
      content: `**生产级 docker-compose.yml 示例**
\`\`\`yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production        # 指定多阶段构建的目标阶段
    image: myapp:\${APP_VERSION:-latest}
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_URL}    # 从 .env 文件读取，不硬编码
    env_file:
      - .env.production
    depends_on:
      db:
        condition: service_healthy     # 等待健康检查通过
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    networks:
      - app-network

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass \${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
\`\`\`

**常用 Compose 命令**
\`\`\`bash
docker compose up -d               # 后台启动
docker compose up -d --build       # 重新构建并启动
docker compose logs -f app         # 实时查看日志
docker compose exec app sh         # 进入容器 shell
docker compose ps                  # 查看服务状态
docker compose down -v             # 停止并删除 volume
\`\`\``,
    },
    {
      title: '5. 镜像优化与发布',
      content: `**镜像大小优化总结**

| 优化手段 | 效果 |
|---------|------|
| 使用 Alpine 基础镜像 | node:20 → node:20-alpine，1.1GB → 150MB |
| 多阶段构建 | 去除构建工具 & devDependencies |
| .dockerignore | 减小构建上下文 |
| 合并 RUN 清理缓存 | 减少层数和大小 |
| distroless/scratch | Go/Rust 应用极小镜像 |

**镜像打标签规范**
\`\`\`bash
# 语义化版本 + git commit hash
docker build -t myapp:1.2.3 -t myapp:1.2.3-abc1234 .

# CI 中自动打标签
docker build \
  -t myregistry/myapp:\${VERSION} \
  -t myregistry/myapp:latest \
  --label "git.commit=\${GIT_SHA}" \
  --label "build.date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  .
\`\`\`

**镜像推送到 Registry**
\`\`\`bash
# 登录到 GitHub Container Registry
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# 推送
docker push ghcr.io/org/myapp:1.2.3

# 使用 Docker BuildKit（并行构建，更快）
DOCKER_BUILDKIT=1 docker build .

# 多平台构建（兼容 ARM Mac 和 x86 服务器）
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myapp:latest --push .
\`\`\``,
    },
  ],
  outputFormat:
    'Markdown 容器化方案，含优化后的 Dockerfile、.dockerignore、docker-compose.yml 配置和安全加固建议',
  examples: [
    {
      input: '帮我给 Node.js TypeScript 项目写一个生产级 Dockerfile',
      output: `## 生产级 Node.js Dockerfile

使用三阶段构建（builder → deps → production），最终镜像约 120MB。

关键优化点：
1. Alpine 基础镜像减小体积
2. builder 阶段编译 TS，deps 阶段只装生产依赖
3. production 阶段只复制必要文件，非 root 用户运行
4. HEALTHCHECK 支持容器健康检查
5. .dockerignore 排除测试文件、.env、.git`,
    },
  ],
  notes: [
    '生产镜像绝不使用 :latest 标签，始终用具体版本号确保可复现',
    '绝不在 Dockerfile 中写入密钥或密码，使用环境变量或 Docker Secrets',
    '每次发版前用 Trivy 扫描镜像漏洞，CRITICAL 漏洞不上线',
    'docker-compose 仅用于本地开发和小规模部署，生产大规模编排推荐 Kubernetes',
  ],
  nextSkill: 'cicd',
};
