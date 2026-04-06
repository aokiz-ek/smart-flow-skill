import type { SkillDefinition } from './types';

export const llmFeatureSkill: SkillDefinition = {
  id: 'llm-feature',
  name: 'LLM 功能设计助手',
  nameEn: 'llm_feature',
  order: 30,
  description: '设计 RAG/Agent/生成类 LLM 功能，输出 Prompt 模板、评估框架与降级方案',
  descriptionEn: 'Design RAG/Agent/generation LLM features with prompt templates, evaluation framework and fallback strategies',
  detailDescription: `将 LLM 集成到产品中远不止调用 API——需要精心的架构设计、Prompt 工程和评估体系。
本 Skill 覆盖 LLM 功能设计全链路：从场景分类（RAG/Agent/生成/分类/提取）到 RAG 架构选型、
Prompt 工程规范，再到自动化评估框架和降级安全策略，
让 AI 功能既好用又可靠，避免幻觉、成本失控和不当内容。`,
  triggers: [
    'llm feature',
    'ai feature',
    'rag',
    'llm 功能',
    'ai 功能设计',
    'prompt design',
    '大模型功能',
    'agent 设计',
    '@ethan llm-feature',
    '/llm-feature',
  ],
  steps: [
    {
      title: '1. LLM 功能定位与场景分类',
      content: `明确 LLM 功能的类型和边界，选择合适的架构模式：

**五大 LLM 场景类型**

| 场景 | 描述 | 典型案例 | 推荐架构 |
|------|------|---------|---------|
| **RAG（检索增强生成）** | 基于私有知识库回答 | 内部文档问答、客服 | 向量检索 + LLM |
| **Agent（自主决策）** | 多步骤工具调用 | 代码 Agent、任务自动化 | LLM + Function Calling |
| **生成** | 创作/摘要/翻译 | 文案生成、会议纪要 | 直接调用 + 结构化输出 |
| **分类** | 意图/情感/标签 | 工单分类、评论分析 | Fine-tune 或 Few-shot |
| **提取** | 信息抽取/NER | 合同关键信息、表单填充 | Structured Output + JSON Schema |

**功能定位问卷**
\`\`\`
1. 用户问题的答案在哪里？
   - 模型已知知识 → 直接生成
   - 私有文档/数据库 → RAG 架构
   - 需要实时操作 → Agent 架构

2. 需要多步推理吗？
   - 是 → Agent（工具调用链）
   - 否 → 单次 Prompt

3. 输出格式是否严格？
   - 是 → JSON Mode / Structured Output
   - 否 → 自然语言生成

4. 延迟要求？
   - < 500ms → 小模型 + 缓存
   - < 3s → 标准调用
   - 可接受流式 → 流式输出
\`\`\`

**输出**：LLM 功能定位文档（场景类型 + 架构选型建议）`,
    },
    {
      title: '2. RAG 架构设计',
      content: `为知识库问答类功能设计高质量 RAG 架构：

**RAG 核心组件**
\`\`\`
文档摄入管道：
Raw Docs → Chunking → Embedding → Vector Store
                ↓
           Metadata 过滤层（时间/来源/权限）

查询管道：
User Query → Query 改写/扩展 → 向量检索 → Rerank → LLM 生成
\`\`\`

**Chunking 策略选型**
\`\`\`typescript
// 固定大小（适合均匀文本）
const CHUNK_SIZE = 512;    // tokens
const CHUNK_OVERLAP = 50;  // 上下文保留

// 语义分块（适合结构化文档，推荐）
// 按段落/标题边界切分
function semanticChunk(text: string): string[] {
  return text.split(/\n#{1,3}\s/);  // Markdown 标题分块
}

// 递归分块（LangChain RecursiveCharacterTextSplitter）
// 优先按段落 → 句子 → 词语拆分
\`\`\`

**向量库选型矩阵**
| 方案 | 适用规模 | 托管 | 特性 |
|------|---------|------|------|
| **Pinecone** | 100万+ | 云托管 | 生产级，自动扩容 |
| **Weaviate** | 中大型 | 自托管/云 | 混合搜索，GraphQL |
| **Chroma** | 开发/小型 | 本地 | 零配置，适合 PoC |
| **pgvector** | 中型 | PostgreSQL | 复用现有 DB |

**Rerank 优化**
\`\`\`typescript
// 两阶段检索：向量粗召回 → 精排重排序
const candidates = await vectorStore.search(query, { topK: 20 });
const reranked = await rerankModel.rank(query, candidates, { topN: 5 });
// 推荐：Cohere Rerank / BGE-Reranker
\`\`\`

**输出**：RAG 架构图 + Chunking 策略 + 向量库选型建议`,
    },
    {
      title: '3. Prompt 工程规范',
      content: `制定高质量 Prompt 的设计规范：

**System Prompt 黄金结构**
\`\`\`
[角色定义] 你是 {产品名} 的 {角色}，专注于 {领域}。
[能力边界] 你可以 {能力列表}。你不能/不应该 {限制列表}。
[输出格式] 请按照以下格式回复：{格式规范}
[行为准则] {特定规则，如：始终用中文回复/引用来源}
\`\`\`

**System Prompt 模板**
\`\`\`typescript
const SYSTEM_PROMPT = \`
你是 Acme Corp 的智能客服助手，专注于解答产品使用和技术支持问题。

## 能力
- 查询订单状态、退换货政策、产品规格
- 引导用户完成常见操作流程
- 基于知识库提供准确答案

## 限制
- 不讨论竞争对手产品
- 不提供具体价格承诺（引导至销售团队）
- 不确定时明确说明，不猜测

## 输出规范
- 语言：与用户保持一致（中/英文）
- 长度：简洁清晰，避免超过 200 字
- 引用：若基于文档回答，在末尾标注 [来源：{文档名}]
\`.trim();
\`\`\`

**Few-shot 示例设计**
\`\`\`typescript
const FEW_SHOT_EXAMPLES = [
  {
    role: 'user',
    content: '我的订单 #12345 什么时候发货？'
  },
  {
    role: 'assistant',
    content: '您好！根据订单信息，#12345 已于昨天完成备货，预计今日发出，3-5个工作日送达。[来源：订单管理文档]'
  }
];
\`\`\`

**关键参数建议**
\`\`\`typescript
// 不同场景的推荐参数
const PARAMS = {
  factual_qa:    { temperature: 0.1, max_tokens: 500 },   // 事实问答，低随机性
  creative:      { temperature: 0.8, max_tokens: 2000 },  // 创意生成
  classification:{ temperature: 0,   max_tokens: 50 },    // 分类，确定性输出
  code_gen:      { temperature: 0.2, max_tokens: 4000 },  // 代码生成
};
\`\`\`

**Token 预算管理**
\`\`\`
System Prompt:   ~500 tokens  （固定）
RAG Context:     ~2000 tokens （动态，按相关度截断）
Conversation:    ~1000 tokens （保留最近 N 轮）
User Query:      ~200 tokens  （预留）
Output:          ~1000 tokens （max_tokens 控制）
总计:            ~4700 tokens  < 8K context window
\`\`\`

**输出**：System Prompt 模板 + Few-shot 示例 + 参数配置建议`,
    },
    {
      title: '4. LLM 评估方案',
      content: `建立自动化 + 人工评估体系，持续监控 LLM 功能质量：

**三层评估框架**

**① 自动化 Evals（CI/CD 集成）**
\`\`\`typescript
// 评估维度
interface EvalResult {
  accuracy: number;      // 答案正确率（对比 Golden Set）
  faithfulness: number;  // 回答与上下文一致性（RAG 专用）
  relevance: number;     // 答案与问题相关度
  latency_p95: number;   // P95 响应时间（ms）
  cost_per_query: number; // 平均 token 成本（$）
}

// 自动评估示例（LLM-as-Judge）
async function evalWithLLM(question: string, answer: string, context: string) {
  const judgePrompt = \`
    问题：\${question}
    检索上下文：\${context}
    模型回答：\${answer}

    请评估回答的准确性（0-1）和忠实度（0-1），返回 JSON：
    {"accuracy": 0.x, "faithfulness": 0.x, "reason": "..."}
  \`;
  return await llm.json(judgePrompt);
}
\`\`\`

**② Golden Set 维护**
\`\`\`json
// evals/golden-set.json
[
  {
    "id": "Q001",
    "question": "退货政策是什么？",
    "expected_keywords": ["30天", "unopened", "退款"],
    "expected_source": "return-policy.md",
    "difficulty": "easy"
  }
]
\`\`\`

**③ 人工评分（A/B 测试）**
\`\`\`
评分维度（1-5分）：
- Helpful（有帮助）: 回答解决了用户问题
- Accurate（准确）: 信息与事实一致
- Safe（安全）: 无有害/不当内容
- Concise（简洁）: 无冗余信息
\`\`\`

**评估指标基准**
| 指标 | 可接受 | 良好 | 优秀 |
|------|--------|------|------|
| 准确率 | > 70% | > 85% | > 95% |
| 忠实度 | > 75% | > 90% | > 97% |
| P95 延迟 | < 5s | < 3s | < 1.5s |
| 幻觉率 | < 15% | < 5% | < 2% |

**输出**：评估脚本 + Golden Set 模板 + A/B 测试方案`,
    },
    {
      title: '5. 降级与安全策略',
      content: `为 LLM 功能设计完善的降级和安全机制：

**五大风险与对策**

**① 幻觉控制**
\`\`\`typescript
// RAG 置信度检查：若无相关文档，拒绝回答
const MIN_SIMILARITY = 0.75;
const docs = await vectorStore.search(query, { topK: 3 });
if (docs[0].score < MIN_SIMILARITY) {
  return { answer: '抱歉，我没有找到相关信息，请联系人工客服。', sources: [] };
}
\`\`\`

**② Fallback 降级链**
\`\`\`typescript
async function robustLLMCall(prompt: string) {
  try {
    // 主模型（高质量）
    return await gpt4o.complete(prompt, { timeout: 5000 });
  } catch (primaryError) {
    try {
      // 降级到备用模型（更快更便宜）
      return await gpt4oMini.complete(prompt, { timeout: 3000 });
    } catch (fallbackError) {
      // 最终降级：静态规则/人工兜底
      return { answer: FALLBACK_MESSAGES[detectIntent(prompt)], fallback: true };
    }
  }
}
\`\`\`

**③ 内容过滤**
\`\`\`typescript
// 输入/输出双向过滤
const BLOCKED_PATTERNS = [/如何.*伤害/, /制作.*武器/];
function isSafe(text: string): boolean {
  return !BLOCKED_PATTERNS.some(p => p.test(text));
}
// 推荐：使用 OpenAI Moderation API / Azure Content Safety
\`\`\`

**④ 成本限制**
\`\`\`typescript
// 每用户每日 Token 限额
const DAILY_TOKEN_LIMIT = 50000;
// 请求频率限制
const RATE_LIMIT = { requests: 10, window: '1m' };
// 输出截断
const MAX_OUTPUT_TOKENS = 1000;
\`\`\`

**⑤ 可观测性**
\`\`\`typescript
// 每次 LLM 调用必须记录
logger.info('llm_call', {
  model, prompt_tokens, completion_tokens, latency_ms,
  user_id, session_id, feature_flag,
  is_fallback, safety_triggered,
});
\`\`\`

**输出**：降级策略代码模板 + 内容安全配置 + 成本控制方案 + 可观测性埋点`,
    },
  ],
  outputFormat: 'LLM 功能定位文档 + RAG 架构图 + System Prompt 模板 + 评估框架（Golden Set + 自动 Evals）+ 降级与安全策略代码',
  examples: [],
  notes: [
    '先从小模型（GPT-4o mini/Claude Haiku）开始验证，确认方案可行再升级到大模型降低成本',
    'RAG 的质量 80% 取决于 Chunking 策略和 Embedding 质量，而非 LLM 本身',
    'Golden Set 至少需要 100 条覆盖核心场景的问答对，建立前先做 10 条快速验证',
    '幻觉是 RAG 的最大风险，必须设置相似度阈值，宁可说"不知道"也不要胡编',
    '生产环境必须监控 Token 消耗和每次调用成本，防止费用失控',
  ],
  category: '需求侧',
  nextSkill: 'system-design',
};
