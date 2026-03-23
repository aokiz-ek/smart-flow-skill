import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ALL_SKILLS } from '../skills/index';
import { PIPELINES } from '../skills/pipeline';
import {
  loadSession,
  markStepDone,
  buildStepPrompt,
  getCurrentStep,
} from '../workflow/state';

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ethan Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0a; --card: #111; --border: #222; --text: #e8e8e8;
    --muted: #666; --blue: #3b82f6; --green: #22c55e;
    --yellow: #eab308; --purple: #a855f7; --red: #ef4444;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
  header { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  header span { color: var(--muted); font-size: 13px; }
  main { max-width: 1280px; margin: 0 auto; padding: 24px; }
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; }
  .stat-card .value { font-size: 32px; font-weight: 700; line-height: 1; }
  .stat-card .label { color: var(--muted); font-size: 12px; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-card.blue .value { color: var(--blue); }
  .stat-card.green .value { color: var(--green); }
  .stat-card.purple .value { color: var(--purple); }
  .stat-card.yellow .value { color: var(--yellow); }
  section { margin-bottom: 40px; }
  section h2 { font-size: 15px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 1024px) { .skills-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .skills-grid { grid-template-columns: 1fr; } }
  .skill-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.15s; }
  .skill-card:hover { border-color: #333; }
  .skill-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .skill-name { font-size: 14px; font-weight: 600; line-height: 1.3; }
  .skill-id { font-size: 11px; color: var(--muted); font-family: monospace; margin-top: 2px; }
  .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
  .badge.需求侧 { background: rgba(59,130,246,0.15); color: var(--blue); }
  .badge.执行侧 { background: rgba(34,197,94,0.15); color: var(--green); }
  .badge.跟踪侧 { background: rgba(234,179,8,0.15); color: var(--yellow); }
  .badge.输出侧 { background: rgba(168,85,247,0.15); color: var(--purple); }
  .badge.质量侧 { background: rgba(239,68,68,0.15); color: var(--red); }
  .skill-desc { font-size: 12px; color: #aaa; line-height: 1.5; }
  .triggers { display: flex; flex-wrap: wrap; gap: 5px; }
  .trigger-tag { font-size: 11px; background: #1a1a1a; border: 1px solid var(--border); color: var(--muted); padding: 2px 7px; border-radius: 4px; }
  .chart-list { display: flex; flex-direction: column; gap: 8px; }
  .chart-row { display: flex; align-items: center; gap: 10px; }
  .chart-label { font-size: 12px; color: #aaa; width: 200px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chart-bar-wrap { flex: 1; background: #1a1a1a; border-radius: 4px; height: 18px; overflow: hidden; }
  .chart-bar { height: 100%; border-radius: 4px; transition: width 0.4s ease; min-width: 2px; background: var(--blue); }
  .chart-count { font-size: 12px; color: var(--muted); width: 32px; text-align: right; flex-shrink: 0; }
  .pipelines-list { display: flex; flex-direction: column; gap: 14px; }
  .pipeline-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .pipeline-header { margin-bottom: 12px; }
  .pipeline-name { font-size: 14px; font-weight: 600; }
  .pipeline-desc { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .pipeline-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .flow-skill { background: #1a1a1a; border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font-size: 12px; color: #ccc; }
  .flow-arrow { color: var(--muted); font-size: 14px; }
  .empty { color: var(--muted); font-size: 13px; font-style: italic; }
  #status { position: fixed; bottom: 16px; right: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; font-size: 12px; color: var(--muted); }

  /* ── Workflow Panel ── */
  .wf-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
  .wf-empty { color: var(--muted); font-size: 13px; }
  .wf-empty code { font-family: monospace; background: #1a1a1a; border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font-size: 12px; }
  .wf-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
  .wf-meta-item { font-size: 12px; color: var(--muted); }
  .wf-meta-item strong { color: var(--text); }
  .wf-progress-bar-wrap { background: #1a1a1a; border-radius: 6px; height: 10px; overflow: hidden; margin-bottom: 16px; }
  .wf-progress-bar { height: 100%; border-radius: 6px; background: var(--blue); transition: width 0.5s ease; }
  .wf-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .wf-step { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #0d0d0d; border: 1px solid var(--border); }
  .wf-step.current { border-color: var(--blue); background: rgba(59,130,246,0.06); }
  .wf-step.done { opacity: 0.6; }
  .wf-step-icon { font-size: 16px; flex-shrink: 0; line-height: 1.4; }
  .wf-step-body { flex: 1; min-width: 0; }
  .wf-step-id { font-size: 12px; font-family: monospace; color: #aaa; }
  .wf-step-summary { font-size: 11px; color: var(--muted); margin-top: 4px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wf-step-current-label { font-size: 11px; color: var(--blue); font-weight: 600; margin-top: 2px; }
  .wf-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .btn { border: none; border-radius: 7px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: var(--blue); color: #fff; }
  .btn-secondary { background: #222; color: var(--text); border: 1px solid var(--border); }
  .btn-success { background: var(--green); color: #fff; }

  /* ── Modal ── */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: #161616; border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 90%; max-width: 680px; max-height: 90vh; overflow-y: auto; position: relative; }
  .modal h3 { font-size: 15px; font-weight: 700; margin-bottom: 16px; }
  .modal pre { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #ccc; background: #0d0d0d; border: 1px solid var(--border); border-radius: 8px; padding: 16px; max-height: 55vh; overflow-y: auto; margin-bottom: 16px; }
  .modal textarea { width: 100%; background: #0d0d0d; border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; padding: 12px; resize: vertical; min-height: 100px; outline: none; font-family: inherit; }
  .modal textarea:focus { border-color: var(--blue); }
  .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
  .modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; line-height: 1; }
  .modal-close:hover { color: var(--text); }
  .wf-completed-banner { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: var(--green); margin-bottom: 16px; }
</style>
</head>
<body>
<header>
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="14" fill="#3b82f6" opacity="0.15"/><path d="M8 14h12M14 8l6 6-6 6" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <h1>Ethan Dashboard</h1>
  <span>AI Workflow Assistant</span>
</header>
<main>
  <div class="stats-row">
    <div class="stat-card blue"><div class="value" id="stat-skills">-</div><div class="label">Skills</div></div>
    <div class="stat-card green"><div class="value" id="stat-pipelines">-</div><div class="label">Pipelines</div></div>
    <div class="stat-card purple"><div class="value" id="stat-execs">-</div><div class="label">Total Executions</div></div>
    <div class="stat-card yellow"><div class="value" id="stat-workflow">-</div><div class="label">Workflow</div></div>
  </div>

  <section>
    <h2>🔄 Current Workflow</h2>
    <div id="workflow-panel"><div class="wf-card"><div class="empty">Loading...</div></div></div>
  </section>

  <section>
    <h2>Skills</h2>
    <div class="skills-grid" id="skills-grid"><div class="empty">Loading...</div></div>
  </section>

  <section>
    <h2>Usage Stats</h2>
    <div class="chart-list" id="chart-list"><div class="empty">Loading...</div></div>
  </section>

  <section>
    <h2>Pipelines</h2>
    <div class="pipelines-list" id="pipelines-list"><div class="empty">Loading...</div></div>
  </section>
</main>
<div id="status">Connecting...</div>

<!-- Prompt Modal -->
<div class="modal-overlay" id="modal-prompt">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('modal-prompt')">&#x2715;</button>
    <h3>当前步骤提示词</h3>
    <pre id="prompt-content"></pre>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="copyPrompt()">复制</button>
      <button class="btn btn-primary" onclick="closeModal('modal-prompt')">关闭</button>
    </div>
  </div>
</div>

<!-- Done Modal -->
<div class="modal-overlay" id="modal-done">
  <div class="modal">
    <button class="modal-close" onclick="closeModal('modal-done')">&#x2715;</button>
    <h3>完成本步 — 填写执行摘要（可选）</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">摘要将作为下一步的上下文输入，简要描述本步产出结果（也可直接点击「确认完成」跳过）。</p>
    <textarea id="done-summary" placeholder="例如：需求文档已完成，用户登录支持手机号+密码，JWT 有效期 7 天..."></textarea>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-done')">取消</button>
      <button class="btn btn-success" id="btn-confirm-done" onclick="submitDone()">确认完成 →</button>
    </div>
  </div>
</div>

<script>
(async function() {
  const status = document.getElementById('status');

  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function badge(category) {
    if (!category) return '';
    return '<span class="badge ' + category + '">' + category + '</span>';
  }

  // ── Workflow Panel ────────────────────────────────────────────────────────

  async function renderWorkflow() {
    const panel = document.getElementById('workflow-panel');
    const statEl = document.getElementById('stat-workflow');
    try {
      const data = await fetchJSON('/api/workflow');
      const session = data.session;
      if (!session) {
        panel.innerHTML = '<div class="wf-card"><div class="wf-empty">暂无进行中的工作流。<br><br>在项目目录运行：<code>ethan workflow start dev-workflow -c "任务描述"</code></div></div>';
        statEl.textContent = '-';
        return;
      }

      const done = session.steps.filter(s => s.status === 'done').length;
      const total = session.steps.length;
      const pct = Math.round((done / total) * 100);
      const currentIdx = session.steps.findIndex(s => s.status === 'in-progress');

      statEl.textContent = session.completed ? '已完成' : (pct + '%');

      const statusIcons = { 'done': '✅', 'in-progress': '▶️', 'pending': '⬜', 'skipped': '⏭️' };

      const stepsHtml = session.steps.map((step, i) => {
        const isCurrent = i === currentIdx;
        const cls = step.status === 'done' ? 'done' : (isCurrent ? 'current' : '');
        const icon = statusIcons[step.status] || '⬜';
        const summaryHtml = step.summary
          ? '<div class="wf-step-summary">' + esc(step.summary) + '</div>'
          : '';
        const currentLabel = isCurrent ? '<div class="wf-step-current-label">▶ 当前步骤</div>' : '';
        return '<div class="wf-step ' + cls + '">' +
          '<div class="wf-step-icon">' + icon + '</div>' +
          '<div class="wf-step-body">' +
          '<div class="wf-step-id">' + (i+1) + '. ' + esc(step.skillId) + '</div>' +
          currentLabel + summaryHtml +
          '</div></div>';
      }).join('');

      const completedBanner = session.completed
        ? '<div class="wf-completed-banner">🎉 工作流已全部完成！运行 <code style="font-family:monospace;font-size:11px">ethan workflow reset</code> 开始新工作流。</div>'
        : '';

      const actionsHtml = session.completed ? '' :
        '<div class="wf-actions">' +
        '<button class="btn btn-secondary" onclick="showPrompt()">查看当前提示词</button>' +
        '<button class="btn btn-primary" onclick="openDoneModal()">完成本步 →</button>' +
        '</div>';

      panel.innerHTML = '<div class="wf-card">' +
        completedBanner +
        '<div class="wf-meta">' +
        '<div class="wf-meta-item"><strong>' + esc(session.pipelineName) + '</strong></div>' +
        '<div class="wf-meta-item">ID: ' + esc(session.id) + '</div>' +
        '<div class="wf-meta-item">' + done + ' / ' + total + ' 步完成</div>' +
        '<div class="wf-meta-item">更新: ' + esc(session.updatedAt.slice(0,19).replace('T',' ')) + '</div>' +
        '</div>' +
        '<div class="wf-progress-bar-wrap"><div class="wf-progress-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="wf-steps">' + stepsHtml + '</div>' +
        actionsHtml +
        '</div>';
    } catch (err) {
      panel.innerHTML = '<div class="wf-card"><div class="wf-empty">加载失败: ' + esc(String(err)) + '</div></div>';
    }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  window.closeModal = function(id) {
    document.getElementById(id).classList.remove('open');
  };

  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  });

  window.showPrompt = async function() {
    const pre = document.getElementById('prompt-content');
    pre.textContent = '加载中...';
    document.getElementById('modal-prompt').classList.add('open');
    try {
      const data = await fetchJSON('/api/workflow/prompt');
      pre.textContent = data.prompt || '（无提示词）';
    } catch (err) {
      pre.textContent = '加载失败: ' + err.message;
    }
  };

  window.copyPrompt = function() {
    const text = document.getElementById('prompt-content').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('#modal-prompt .btn-secondary');
      const orig = btn.textContent;
      btn.textContent = '✅ 已复制';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  };

  window.openDoneModal = function() {
    document.getElementById('done-summary').value = '';
    document.getElementById('modal-done').classList.add('open');
    document.getElementById('done-summary').focus();
  };

  window.submitDone = async function() {
    const summary = document.getElementById('done-summary').value.trim();
    // summary is now optional — proceed even if empty
    document.getElementById('done-summary').style.borderColor = '';
    const btn = document.getElementById('btn-confirm-done');
    btn.textContent = '提交中...';
    btn.disabled = true;
    try {
      const r = await fetch('/api/workflow/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      if (!r.ok) throw new Error(await r.text());
      closeModal('modal-done');
      await renderWorkflow();
    } catch (err) {
      alert('提交失败: ' + err.message);
    } finally {
      btn.textContent = '确认完成 →';
      btn.disabled = false;
    }
  };

  // ── Skills ─────────────────────────────────────────────────────────────────

  function renderSkills(skills) {
    const grid = document.getElementById('skills-grid');
    if (!skills.length) { grid.innerHTML = '<div class="empty">No skills found.</div>'; return; }
    grid.innerHTML = skills.map(s => {
      const topTriggers = (s.triggers || []).slice(0, 3);
      const tags = topTriggers.map(t => '<span class="trigger-tag">' + esc(t) + '</span>').join('');
      return '<div class="skill-card">' +
        '<div class="skill-header"><div><div class="skill-name">' + esc(s.name) + '</div><div class="skill-id">' + esc(s.id) + '</div></div>' + badge(s.category) + '</div>' +
        '<div class="skill-desc">' + esc(s.description) + '</div>' +
        (tags ? '<div class="triggers">' + tags + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function renderChart(skills, stats) {
    const list = document.getElementById('chart-list');
    const usage = (stats && stats.skillUsage) ? stats.skillUsage : {};
    const rows = skills.map(s => ({ name: s.name, id: s.id, count: usage[s.id] || 0 }));
    rows.sort((a, b) => b.count - a.count);
    const max = Math.max(...rows.map(r => r.count), 1);
    list.innerHTML = rows.map(r => {
      const pct = Math.round((r.count / max) * 100);
      return '<div class="chart-row">' +
        '<div class="chart-label">' + esc(r.name) + '</div>' +
        '<div class="chart-bar-wrap"><div class="chart-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="chart-count">' + r.count + '</div>' +
        '</div>';
    }).join('');
  }

  function renderPipelines(pipelines, skills) {
    const list = document.getElementById('pipelines-list');
    if (!pipelines.length) { list.innerHTML = '<div class="empty">No pipelines found.</div>'; return; }
    const skillMap = {};
    skills.forEach(s => { skillMap[s.id] = s.name; });
    list.innerHTML = pipelines.map(p => {
      const flow = (p.skillIds || []).map((id, i) => {
        const name = skillMap[id] || id;
        return (i > 0 ? '<span class="flow-arrow">&#8594;</span>' : '') + '<span class="flow-skill">' + esc(name) + '</span>';
      }).join('');
      return '<div class="pipeline-card">' +
        '<div class="pipeline-header"><div class="pipeline-name">' + esc(p.name) + '</div><div class="pipeline-desc">' + esc(p.description) + '</div></div>' +
        '<div class="pipeline-flow">' + flow + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Initial load ───────────────────────────────────────────────────────────

  try {
    const [skills, stats, pipelines] = await Promise.all([
      fetchJSON('/api/skills'),
      fetchJSON('/api/stats').catch(() => ({})),
      fetchJSON('/api/pipelines'),
    ]);

    document.getElementById('stat-skills').textContent = skills.length;
    document.getElementById('stat-pipelines').textContent = pipelines.length;
    const totalExecs = stats && stats.skillUsage
      ? Object.values(stats.skillUsage).reduce((a, b) => a + b, 0)
      : 0;
    document.getElementById('stat-execs').textContent = totalExecs;

    renderSkills(skills);
    renderChart(skills, stats);
    renderPipelines(pipelines, skills);

    status.textContent = 'Loaded ' + new Date().toLocaleTimeString();
  } catch (err) {
    status.style.color = '#ef4444';
    status.textContent = 'Error: ' + err.message;
  }

  // Workflow panel — initial + auto-refresh every 5s
  await renderWorkflow();
  setInterval(renderWorkflow, 5000);
})();
</script>
</body>
</html>`;

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function startDashboardServer(port: number, cwd: string = process.cwd()): void {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // ── GET / ──────────────────────────────────────────��─────────────────────
    if (method === 'GET' && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML);
      return;
    }

    // ── GET /api/skills ──────────────────────────────────────────────────────
    if (method === 'GET' && url === '/api/skills') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ALL_SKILLS));
      return;
    }

    // ── GET /api/stats ───────────────────────────────────────────────────────
    if (method === 'GET' && url === '/api/stats') {
      const statsPath = path.join(os.homedir(), '.ethan-stats.json');
      try {
        const raw = fs.readFileSync(statsPath, 'utf-8');
        const data = JSON.parse(raw);
        // Support both v1 (plain Record<string,number>) and v2 ({usage:{}, streak:{}, dailyLog:{}}) formats
        const skillUsage = data && typeof data.usage === 'object' ? data.usage : data;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ skillUsage }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      }
      return;
    }

    // ── GET /api/pipelines ───────────────────────────────────────────────────
    if (method === 'GET' && url === '/api/pipelines') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(PIPELINES));
      return;
    }

    // ── GET /api/workflow ────────────────────────────────────────────────────
    if (method === 'GET' && url === '/api/workflow') {
      const session = loadSession(cwd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ session: session ?? null }));
      return;
    }

    // ── GET /api/workflow/prompt ─────────────────────────────────────────────
    if (method === 'GET' && url === '/api/workflow/prompt') {
      const session = loadSession(cwd);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active workflow session' }));
        return;
      }
      const currentStep = getCurrentStep(session);
      if (!currentStep) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ prompt: '工作流已全部完成。' }));
        return;
      }
      const skill = ALL_SKILLS.find((s) => s.id === currentStep.skillId);
      if (!skill) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Skill not found: ${currentStep.skillId}` }));
        return;
      }
      const prompt = buildStepPrompt(session, currentStep, skill);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt }));
      return;
    }

    // ── POST /api/workflow/done ──────────────────────────────────────────────
    if (method === 'POST' && url === '/api/workflow/done') {
      let body: string;
      try {
        body = await parseBody(req);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read request body' }));
        return;
      }
      let summary: string;
      try {
        const parsed = JSON.parse(body) as { summary?: string };
        summary = (parsed.summary ?? '').trim();
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
      // summary is optional — allow empty
      const session = loadSession(cwd);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active workflow session' }));
        return;
      }
      if (session.completed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Workflow already completed' }));
        return;
      }
      markStepDone(session, summary, cwd);
      const updated = loadSession(cwd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ session: updated }));
      return;
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`\n🌐 Ethan Dashboard running at http://localhost:${port}`);
    console.log(`   Workflow panel auto-refreshes every 5s`);
    console.log(`   Press Ctrl+C to stop.\n`);
  });
}
