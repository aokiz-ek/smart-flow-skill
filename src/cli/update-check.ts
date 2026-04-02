/**
 * 静默版本检测：异步查询 npm registry，有新版本时自动后台升级。
 * 使用 Node 18+ 内置 fetch，无需额外依赖。
 * 结果缓存到 ~/.ethan-update-cache.json，每 24 小时检查一次。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

const CACHE_FILE = path.join(os.homedir(), '.ethan-update-cache.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

interface UpdateCache {
  lastChecked: number;
  latestVersion: string;
  upgradedVersion?: string; // 已触发自动升级的版本，防重复
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
 * 后台静默自动升级，不阻塞父进程退出。
 * 防重复：若缓存中 upgradedVersion === latest 则跳过。
 */
function autoUpgrade(packageName: string, latest: string, cache: UpdateCache | null, now: number): void {
  if (cache?.upgradedVersion === latest) return; // 已升级过，跳过

  const isWin = process.platform === 'win32';
  const npm = isWin ? 'npm.cmd' : 'npm';

  try {
    const child = spawn(npm, ['install', '-g', `${packageName}@latest`], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref(); // 不阻塞父进程
  } catch {
    // spawn 失败静默忽略（如 npm 不在 PATH）
    return;
  }

  // 写缓存，记录已触发升级
  writeCache({ lastChecked: now, latestVersion: latest, upgradedVersion: latest });

  // 进程退出时打印简短通知
  process.on('exit', () => {
    process.stderr.write(`\n  🔄  Ethan 正在后台自动升级到 v${latest}，重启终端后生效。\n\n`);
  });
}

/**
 * 后台静默检查更新，有新版本时自动触发升级，不阻塞 CLI 启动。
 */
export function checkForUpdates(currentVersion: string, packageName: string): void {
  const cache = readCache();
  const now = Date.now();

  // 使用缓存结果（未超过 24h）
  if (cache && now - cache.lastChecked < CHECK_INTERVAL_MS) {
    if (compareVersions(currentVersion, cache.latestVersion)) {
      autoUpgrade(packageName, cache.latestVersion, cache, now);
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
      writeCache({ lastChecked: now, latestVersion: latest, upgradedVersion: cache?.upgradedVersion });
      if (compareVersions(currentVersion, latest)) {
        autoUpgrade(packageName, latest, cache, now);
      }
    })
    .catch(() => {
      // 网络失败静默忽略
    });
}
