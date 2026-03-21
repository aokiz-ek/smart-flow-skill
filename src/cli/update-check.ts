/**
 * 静默版本检测：异步查询 npm registry，有新版本时打印提示。
 * 使用 Node 18+ 内置 fetch，无需额外依赖。
 * 结果缓存到 ~/.ethan-update-cache.json，每 24 小时检查一次。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_FILE = path.join(os.homedir(), '.ethan-update-cache.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
}

function readCache(): UpdateCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCache(data: UpdateCache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // ignore
  }
}

function compareVersions(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [lMaj, lMin, lPat] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

/**
 * 后台静默检查更新，不阻塞 CLI 启动。
 * 在当前进程退出前异步打印提示（如有新版本）。
 */
export function checkForUpdates(currentVersion: string, packageName: string): void {
  const cache = readCache();
  const now = Date.now();

  // 使用缓存结果（未超过 24h）
  if (cache && now - cache.lastChecked < CHECK_INTERVAL_MS) {
    if (compareVersions(currentVersion, cache.latestVersion)) {
      printUpdateNotice(currentVersion, cache.latestVersion, packageName);
    }
    return;
  }

  // 异步查询，不阻塞
  fetch(`https://registry.npmjs.org/${packageName}/latest`, {
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => res.json())
    .then((data: unknown) => {
      const latest = (data as Record<string, string>).version;
      if (typeof latest !== 'string') return;
      writeCache({ lastChecked: now, latestVersion: latest });
      if (compareVersions(currentVersion, latest)) {
        // 注册进程退出时打印，避免干扰命令输出
        process.on('exit', () => {
          printUpdateNotice(currentVersion, latest, packageName);
        });
      }
    })
    .catch(() => {
      // 网络失败静默忽略
    });
}

function printUpdateNotice(current: string, latest: string, packageName: string): void {
  const lines = [
    '',
    `  ╭─────────────────────────────────────────╮`,
    `  │                                         │`,
    `  │   🆕  Ethan 有新版本可用！              │`,
    `  │                                         │`,
    `  │   ${current.padEnd(10)} → ${latest.padEnd(10)}              │`,
    `  │                                         │`,
    `  │   npm install -g ${packageName}         │`,
    `  │   npx ${packageName}@latest             │`,
    `  │                                         │`,
    `  ╰─────────────────────────────────────────╯`,
    '',
  ];
  process.stderr.write(lines.join('\n') + '\n');
}
