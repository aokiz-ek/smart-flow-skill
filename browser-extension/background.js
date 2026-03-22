/**
 * Ethan Browser Extension — Background Service Worker
 * Handles context menus and cross-tab messaging
 */

// ── Context Menu Setup ──────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ethan-root',
    title: 'Ethan ⚡',
    contexts: ['selection', 'page'],
  });

  chrome.contextMenus.create({
    id: 'ethan-review',
    parentId: 'ethan-root',
    title: '🔍 Code Review 选中内容',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'ethan-explain',
    parentId: 'ethan-root',
    title: '📖 解释选中代码',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'ethan-naming',
    parentId: 'ethan-root',
    title: '🏷️ 命名建议',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'ethan-pr-review',
    parentId: 'ethan-root',
    title: '📋 生成 PR Review 提示词（当前页面）',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'ethan-separator',
    parentId: 'ethan-root',
    type: 'separator',
    contexts: ['selection', 'page'],
  });

  chrome.contextMenus.create({
    id: 'ethan-copy-url',
    parentId: 'ethan-root',
    title: '🔗 复制页面上下文到剪贴板',
    contexts: ['page'],
  });
});

// ── Context Menu Handler ────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  const selectedText = info.selectionText || '';
  const pageUrl = tab.url || '';

  switch (info.menuItemId) {
    case 'ethan-review':
      generateAndCopy('review', selectedText, pageUrl, tab.id);
      break;
    case 'ethan-explain':
      generateAndCopy('explain', selectedText, pageUrl, tab.id);
      break;
    case 'ethan-naming':
      generateAndCopy('naming', selectedText, pageUrl, tab.id);
      break;
    case 'ethan-pr-review':
      chrome.tabs.sendMessage(tab.id, { action: 'extract-pr-context' }, (response) => {
        if (response?.context) {
          generateAndCopy('pr-review', response.context, pageUrl, tab.id!);
        }
      });
      break;
    case 'ethan-copy-url':
      chrome.tabs.sendMessage(tab.id, { action: 'get-page-context' }, (response) => {
        if (response?.context) {
          copyToClipboard(response.context, tab.id!);
        }
      });
      break;
  }
});

// ── Prompt Generators ───────────────────────────────────────────────────────
function generateAndCopy(type, selectedText, pageUrl, tabId) {
  let prompt = '';

  switch (type) {
    case 'review':
      prompt = `你是一名资深工程师，请对以下代码进行 Code Review。

## 代码来源
${pageUrl}

## 代码
\`\`\`
${selectedText}
\`\`\`

## 输出格式
按 🔴 Blocker / 🟡 Major / 🟢 Minor 分级，每条给出改进建议。`;
      break;

    case 'explain':
      prompt = `请解释以下代码的作用和实现原理：

## 代码来源
${pageUrl}

## 代码
\`\`\`
${selectedText}
\`\`\`

请输出：1. 核心功能（一句话）2. 逐块解析 3. 关键技术点 4. 潜在问题`;
      break;

    case 'naming':
      prompt = `请为以下描述生成命名候选（变量/函数/类/文件名）：

## 描述
${selectedText}

请提供：camelCase、PascalCase、snake_case 三种风格，每种 5 个候选，按推荐度排序，附简短说明。`;
      break;

    case 'pr-review':
      prompt = `你是一名资深工���师，请对以下 PR 进行 Code Review。

## PR 链接
${pageUrl}

## PR 内容
${selectedText}

## 输出格式
1. 总体评价
2. 问题列表（Blocker → Major → Minor）
3. Review 结论（通过/需修改/需重大修改）`;
      break;
  }

  if (prompt) copyToClipboard(prompt, tabId);
}

// ── Clipboard Helper ────────────────────────────────────────────────────────
async function copyToClipboard(text, tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (t) => navigator.clipboard.writeText(t),
      args: [text],
    });
    chrome.tabs.sendMessage(tabId, { action: 'show-toast', message: '✅ Ethan 提示词已复制到剪贴板！' });
  } catch (e) {
    console.error('Clipboard error:', e);
  }
}
