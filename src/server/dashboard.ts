import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ALL_SKILLS } from '../skills/index';
import { PIPELINES } from '../skills/pipeline';

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
  </div>

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

<script>
(async function() {
  const status = document.getElementById('status');

  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }

  function badge(category) {
    if (!category) return '';
    return '<span class="badge ' + category + '">' + category + '</span>';
  }

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

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

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
})();
</script>
</body>
</html>`;

export function startDashboardServer(port: number): void {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML);
      return;
    }

    if (url === '/api/skills') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ALL_SKILLS));
      return;
    }

    if (url === '/api/stats') {
      const statsPath = path.join(os.homedir(), '.ethan-stats.json');
      try {
        const raw = fs.readFileSync(statsPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(raw);
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      }
      return;
    }

    if (url === '/api/pipelines') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(PIPELINES));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`\n🌐 Ethan Dashboard running at http://localhost:${port}\n   Press Ctrl+C to stop.\n`);
  });
}
