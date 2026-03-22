/**
 * Ethan Extension Popup Script
 */

const SKILLS = [
  { id: 'requirement-understanding', name: '需求理解', icon: '📋' },
  { id: 'task-breakdown', name: '任务拆解', icon: '🔀' },
  { id: 'solution-design', name: '方案设计', icon: '🏗️' },
  { id: 'implementation', name: '执行实现', icon: '⚡' },
  { id: 'code-review', name: '代码审查', icon: '🔍' },
  { id: 'debug', name: '故障排查', icon: '🐛' },
  { id: 'tech-research', name: '技术调研', icon: '🔬' },
  { id: 'progress-tracking', name: '进度跟踪', icon: '📊' },
  { id: 'task-report', name: '任务报告', icon: '📄' },
];

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

// ── Copy to Clipboard ───────────────────────────────────────────────────────
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ 提示词已复制到剪贴板！');
  } catch {
    showToast('❌ 复制失败，请手动复制');
  }
}

// ── Get active tab context ──────────────────────────────────────────────────
async function getTabContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { tab, url: tab?.url || '', title: tab?.title || '' };
}

// ── Prompt Generators ───────────────────────────────────────────────────────
function buildSkillPrompt(skillId, skillName, context, pageUrl) {
  const skillDescriptions = {
    'requirement-understanding': '深度解析用户需求，消除歧义，输出结构化需求文档',
    'task-breakdown': '将复杂需求拆解为可执行的原子任务，建立依赖关系和优先级',
    'solution-design': '输出技术方案设计文档，包含架构选择、接口设计、数据模型',
    'implementation': '按设计方案逐步实现代码，遵循最佳实践',
    'code-review': '系统性审查代码，分级输出 Blocker/Major/Minor',
    'debug': '假设验证 + 5 Why 根因分析，提供三层解决方案',
    'tech-research': '加权评分矩阵 + POC 验证，输出有据可查的结论',
    'progress-tracking': '实时更新任务状态，识别阻塞风险，保持项目透明度',
    'task-report': '任务完成后生成总结报告，记录成果、问题和经验教训',
  };

  return `你是一名 AI 工作流助手，请执行 "${skillName}" Skill。

## 任务背景
页面：${pageUrl}
上下文：${context || '（请描述你的任务背景）'}

## Skill 目标
${skillDescriptions[skillId] || skillName}

请按照该 Skill 的标准流程，输出结构化结果。`;
}

// ── Action Handlers ─────────────────────────────────────────────────────────
async function handleAction(action) {
  const { tab, url } = await getTabContext();
  if (!tab?.id) return;

  // Get selected text from page
  let selectedText = '';
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    });
    selectedText = results?.[0]?.result || '';
  } catch { /* ignore */ }

  switch (action) {
    case 'review': {
      if (!selectedText) { showToast('⚠️ 请先在页面选中代码'); return; }
      const prompt = `你是一名资深工程师，请对以下代码进行 Code Review。

## 代码来源
${url}

## 代码
\`\`\`
${selectedText.slice(0, 6000)}
\`\`\`

按 🔴 Blocker / 🟡 Major / 🟢 Minor 分级，每条给出改进建议。`;
      await copyText(prompt);
      break;
    }

    case 'explain': {
      if (!selectedText) { showToast('⚠️ 请先在页面选中代码'); return; }
      const prompt = `请解释以下代码：

## 来源：${url}

\`\`\`
${selectedText.slice(0, 5000)}
\`\`\`

请输出：1. 核心功能 2. 逐块解析 3. 关键技术点 4. 潜在问题`;
      await copyText(prompt);
      break;
    }

    case 'pr-review': {
      // Extract PR context from content script
      let context = `页面：${url}\n标题：${tab.title}`;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract-pr-context' });
        if (response?.context) context = response.context;
      } catch { /* page may not be a PR */ }

      const prompt = `你是一名资深工程师，请对以下 GitHub PR 进行 Code Review。

## PR 链接
${url}

${context}

按 🔴 Blocker / 🟡 Major / 🟢 Minor 分级，最后给出 Review 结论。`;
      await copyText(prompt);
      break;
    }

    case 'commit': {
      const prompt = `请根据以下信息生成规范的 Git Commit Message（Conventional Commits 格式）。

## 页面上下文
${url}
${selectedText ? `\n## 相关内容\n${selectedText.slice(0, 2000)}` : ''}

请直接输出 Commit Message，格式：type(scope): subject`;
      await copyText(prompt);
      break;
    }

    case 'naming': {
      const content = selectedText || tab.title || '';
      if (!content) { showToast('⚠️ 请先选中要命名的描述'); return; }
      const prompt = `请为以下描述生成命名候选（变量/函数/类/文件名）：

## 描述
${content.slice(0, 500)}

请提供 camelCase、PascalCase、snake_case 三种风格，每种 5 个候选，附简短说明。`;
      await copyText(prompt);
      break;
    }

    case 'standup': {
      const prompt = `请根据以下页面内容生成简洁的站会发言稿（60-120字）：

## 页面：${url}
## 标题：${tab.title}
${selectedText ? `\n## 选中内容\n${selectedText.slice(0, 1000)}` : ''}

格式：1. 昨日完成 2. 今日计划 3. 阻塞/风险`;
      await copyText(prompt);
      break;
    }
  }
}

// ── Skill Grid ───────────────────────────────────────────────────────────────
function renderSkillGrid() {
  const grid = document.getElementById('skills-grid');
  SKILLS.forEach((skill) => {
    const btn = document.createElement('button');
    btn.className = 'skill-btn';
    btn.innerHTML = `<span class="skill-icon">${skill.icon}</span>${skill.name}`;
    btn.title = skill.name;
    btn.addEventListener('click', async () => {
      const { url } = await getTabContext();
      let selectedText = '';
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() || '',
          });
          selectedText = results?.[0]?.result || '';
        }
      } catch { /* ignore */ }
      const prompt = buildSkillPrompt(skill.id, skill.name, selectedText, url);
      await copyText(prompt);
    });
    grid.appendChild(btn);
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSkillGrid();

  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.action);
    });
  });
});
