import type { SkillDefinition } from './types';

export const implementationSkill: SkillDefinition = {
  id: 'implementation',
  name: '执行实现',
  nameEn: 'implementation',
  order: 4,
  description: '按设计方案逐步实现代码，遵循最佳实践，同步记录实现决策',
  detailDescription: `进入编码阶段，按任务拆解的顺序逐一实现功能：先写测试或接口定义，
再实现核心逻辑，遵循 SOLID 原则和项目既有规范，对非显而易见的实现决策作简要注释。`,
  triggers: [
    '执行实现',
    '开始实现',
    '写代码',
    '编写代码',
    '实现功能',
    '代码实现',
    '开始开发',
    '/执行实现',
    '@ethan 实现',
  ],
  steps: [
    {
      title: '1. 确认实现前提',
      content: `在开始写代码前确认：
- ✅ 设计方案已确认
- ✅ 依赖的接口/服务已就绪（或已 mock）
- ✅ 开发环境配置正确
- ✅ 知道本次实现的完成标准（Definition of Done）`,
    },
    {
      title: '2. 分层实现顺序',
      content: `推荐实现顺序（由内而外）：
1. **数据层**：Model/Schema 定义、数据库迁移
2. **服务层**：业务逻辑、核心算法
3. **接口层**：Controller/Route/Resolver
4. **UI 层**：页面组件、交互逻辑
5. **集成**：端对端连通、Edge Cases 处理`,
    },
    {
      title: '3. 编码规范执行',
      content: `- 函数单一职责，超过 50 行考虑拆分
- 命名自文档化：\`getUserByEmail\` > \`getUser\`
- 错误处理：不吞异常，向上传递有语义的错误
- 对**非显而易见**的逻辑写注释（解释"为什么"而非"做什么"）
- 涉及安全的操作（SQL 查询、用户输入）必须做参数化/转义`,
    },
    {
      title: '4. 每完成一个任务后',
      content: `- 执行单元测试（或手动验证）
- 更新任务状态（参考"进度跟踪" Skill）
- 如遇到设计偏差，记录变更原因
- commit 前检查：无 console.log 遗留、无硬编码密钥`,
    },
    {
      title: '5. 代码自检清单',
      content: `\`\`\`
□ 功能满足需求文档的验收条件
□ 边界条件已处理（null、空数组、超长输入等）
□ 错误信息对用户友好（生产环境不暴露内部堆栈）
□ 无明显性能问题（N+1 查询、无限循环风险）
□ 敏感数据不出现在日志中
□ 代码可读性：同事无需解释能看懂
\`\`\``,
    },
  ],
  outputFormat: '代码实现 + 简要说明（实现思路、关键决策），每个任务完成后输出自检清单结果',
  notes: [
    '不要一次性写完所有代码，小步提交，频繁验证',
    '遇到阻塞（依赖未就绪）立即反馈，不要等待',
    '实现过程中发现设计问题，先暂停讨论，不要随意修改设计',
  ],
  category: '执行侧',
  nextSkill: 'progress-tracking',
};
