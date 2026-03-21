import type { SkillDefinition } from './types';

export const taskReportSkill: SkillDefinition = {
  id: 'task-report',
  name: '任务报告',
  nameEn: 'task_report',
  order: 6,
  description: '任务完成后生成总结报告，记录成果、问题和经验教训',
  descriptionEn: 'Generate outcome report with issue retrospective and lessons learned',
  detailDescription: `在任务或阶段完成后，生成全面的总结报告：梳理完成情况、
遇到的问题和解决方式、技术债务、经验教训，为后续迭代提供参考。`,
  triggers: [
    '任务报告',
    '生成报告',
    '任务总结',
    '总结报告',
    '完成总结',
    '项目总结',
    '阶段总结',
    '/任务报告',
    '@ethan 报告',
    'task report',
    'generate report',
    '@ethan report',
  ],
  steps: [
    {
      title: '1. 成果汇总',
      content: `- 列出本次完成的所有功能点（对照原始需求）
- 说明是否满足所有验收条件
- 对比原计划：提前/按时/延期（延期说明原因）
- 关键交付物清单（代码链接、文档、部署地址）`,
    },
    {
      title: '2. 问题复盘',
      content: `对本次遇到的主要问题进行复盘：

| 问题描述 | 根本原因 | 解决方案 | 预防措施 |
|---------|---------|---------|---------|
| [问题] | [原因] | [解决] | [预防] |`,
    },
    {
      title: '3. 技术债务记录',
      content: `记录本次故意留下的技术债务（TODO/FIXME）：
- 债务描述：[内容]
- 产生原因：[为什么现在不做]
- 影响范围：[哪些功能受影响]
- 计划处理时间：[迭代版本]`,
    },
    {
      title: '4. 性能与质量指标',
      content: `- 测试覆盖率：[X%]
- 已知 Bug：[数量及严重程度]
- 关键路径性能：[响应时间/吞吐量等]
- 代码审查意见处理：[X 条，已解决 Y 条]`,
    },
    {
      title: '5. 经验教训（Lessons Learned）',
      content: `**做得好的地方：**
- [值得在下次继续的做法]

**可以改进的地方：**
- [下次应该不同的做法]

**给团队的建议：**
- [可复用的最佳实践或工具]`,
    },
  ],
  outputFormat:
    'Markdown 总结报告，含成果汇总、问题复盘表格、技术债务列表、质量指标、Lessons Learned',
  notes: [
    '报告面向不同读者（技术/产品/管理），注意分层表达',
    '技术债务必须记录，不能以"以后再说"带过',
    'Lessons Learned 重在行动可操作性，避免空话',
  ],
  category: '输出侧',
  nextSkill: 'weekly-report',
};
