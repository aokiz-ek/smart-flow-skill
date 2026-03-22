/**
 * Ethan Content Script — injected into GitHub PR/Issue pages
 * Adds "Ethan Review" button to PR diff view
 */

(function () {
  'use strict';

  // ── Toast Notification ──────────────────────────────────────────────────
  function showToast(message, duration = 3000) {
    const existing = document.getElementById('ethan-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ethan-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow then show
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ── Extract PR Context ──────────────────────────────────────────────────
  function extractPRContext() {
    const title = document.querySelector('.js-issue-title, [data-testid="issue-title"]')?.textContent?.trim() || '';
    const body = document.querySelector('.comment-body, .js-comment-body')?.textContent?.trim() || '';
    const diffFiles = Array.from(document.querySelectorAll('.file-header')).map(
      (el) => el.querySelector('.file-info a')?.textContent?.trim() || ''
    ).filter(Boolean);

    return [
      `## PR 标题\n${title}`,
      body ? `## PR 描述\n${body}` : '',
      diffFiles.length > 0 ? `## 变更文件（${diffFiles.length} 个）\n${diffFiles.map((f) => `- ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  }

  // ── Get Page Context ────────────────────────────────────────────────────
  function getPageContext() {
    return `页面标题：${document.title}\nURL：${location.href}\n\n${document.querySelector('main, article, .markdown-body')?.textContent?.slice(0, 3000) || ''}`;
  }

  // ── Inject Ethan Button into PR Pages ──────────────────────────────────
  function injectPRButton() {
    // Avoid double injection
    if (document.getElementById('ethan-pr-btn')) return;

    // Find the PR action toolbar
    const toolbar =
      document.querySelector('.gh-header-actions') ||
      document.querySelector('.pr-review-tools') ||
      document.querySelector('[data-testid="pr-toolbar"]');

    if (!toolbar) return;

    const btn = document.createElement('button');
    btn.id = 'ethan-pr-btn';
    btn.className = 'ethan-btn';
    btn.innerHTML = '⚡ Ethan Review';
    btn.title = '使用 Ethan 生成 Code Review 提示词';

    btn.addEventListener('click', () => {
      const context = extractPRContext();
      const prompt = `你是一名资深工程师，请对以下 GitHub PR 进行系统性 Code Review。

## PR 信息
URL：${location.href}

${context}

## Review 要求
按以下维度逐层分析，标注严重级别：
- 🔴 Blocker：必须修复（正确性/安全/数据风险）
- 🟡 Major：强烈建议（性能/可维护性/规范）
- 🟢 Minor：可选优化（风格/命名/可读性）

## 输出格式
1. 总体评价（1-2句）
2. 问题列表（按 Blocker → Major → Minor）
3. Review 结论`;

      navigator.clipboard.writeText(prompt).then(() => {
        showToast('✅ Ethan PR Review 提示词已复制到剪贴板！');
      });
    });

    toolbar.insertBefore(btn, toolbar.firstChild);
  }

  // ── Message Listener ────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extract-pr-context') {
      sendResponse({ context: extractPRContext() });
    } else if (msg.action === 'get-page-context') {
      sendResponse({ context: getPageContext() });
    } else if (msg.action === 'show-toast') {
      showToast(msg.message);
    }
    return true;
  });

  // ── Init ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPRButton);
  } else {
    injectPRButton();
  }

  // Re-inject on navigation (GitHub uses Turbo/Pjax)
  const observer = new MutationObserver(() => {
    injectPRButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
