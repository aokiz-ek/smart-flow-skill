import type { SkillDefinition } from './types';

export const designSkill: SkillDefinition = {
  id: 'solution-design',
  name: '方案设计',
  nameEn: 'solution_design',
  order: 3,
  description: '输出技术方案设计文档，包含架构选择、接口设计、数据模型和关键决策说明',
  descriptionEn: 'Output architecture design, API design, and data model',
  detailDescription: `在需求明确、任务拆解完成后，进行技术方案设计：选择合适的技术架构、
设计 API 接口、规划数据模型、说明关键技术决策和权衡，输出可直接指导实现的设计文档。`,
  triggers: [
    '方案设计',
    '技术方案',
    '架构设计',
    '设计方案',
    '怎么设计',
    '数据库设计',
    '接口设计',
    'API 设计',
    '/方案设计',
    '@ethan 设计',
    'solution design',
    'tech design',
    '@ethan design',
  ],
  steps: [
    {
      title: '1. 技术选型',
      content: `- 列出关键技术决策点（框架、数据库、缓存、消息队列等）
- 每个决策给出 2-3 个候选方案，并说明**选择理由**
- 格式：「选择 A 而非 B，原因：[理由]；权衡：[牺牲了什么]」`,
    },
    {
      title: '2. 架构设计',
      content: `- 用 ASCII 图或 Mermaid 描述系统架构
- 说明各组件的职责和交互方式
- 标注关键数据流向

\`\`\`mermaid
graph LR
  Client --> API[API Server]
  API --> DB[(Database)]
  API --> Cache[(Redis)]
\`\`\``,
    },
    {
      title: '3. 接口设计（API）',
      content: `按 RESTful 或 GraphQL 规范设计接口：

\`\`\`
POST /api/v1/[resource]
Request:  { field1: type, field2: type }
Response: { code: 0, data: {...}, message: string }
\`\`\`

- 统一错误码规范
- 鉴权方式（Bearer Token / Cookie / API Key）`,
    },
    {
      title: '4. 数据模型',
      content: `- 核心实体及字段（类型、约束、索引）
- 实体关系（1:1、1:N、N:M）
- 关键查询场景和对应索引策略`,
    },
    {
      title: '5. 关键技术决策记录（ADR）',
      content: `对每个重要决策记录：
- **背景**：为什么需要做这个决策
- **决策**：选择了什么
- **后果**：带来什么影响（正面/负面）`,
    },
  ],
  outputFormat:
    'Markdown 设计文档，含技术选型表、架构图（Mermaid）、API 接口列表、数据模型、ADR 决策记录',
  notes: [
    '先设计接口契约，再实现内部逻辑',
    '数据模型是设计的核心，多花时间在这里',
    'ADR 不需要面面俱到，只记录有争议的或重要的决策',
  ],
  category: '执行侧',
  nextSkill: 'implementation',
};
