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
 * 防重复：若缓存中 upgradedVersion === latest 且当前版本已是最新，则跳过。
 * 智能重试：若缓存 upgradedVersion === latest 但当前版本仍低于 latest，说明上次升级失败，应重试。
 */
function autoUpgrade(packageName: string, latest: string, cache: UpdateCache | null, now: number, currentVersion: string): void {
  // 跳过条件：已标记为已升级，且当前版本确实已不低于 latest（升级成功）
  if (cache?.upgradedVersion === latest && !compareVersions(currentVersion, latest)) return;

  const isWin = process.platform === 'win32';
  const npm = isWin ? 'npm.cmd' : 'npm';

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(npm, ['install', '-g', `${packageName}@latest`], {
      detached: true,
      stdio: 'ignore',
      // shell: true 确保 Windows / nvm-windows 下能正确找到 npm
      shell: process.platform === 'win32',
    });
  } catch {
    // spawn 失败（npm 不在 PATH）—— 提示用户手动升级
    process.on('exit', () => {
      process.stderr.write(
        `  ⚠️  后台自动升级失败：找不到 npm。请手动运行: npm install -g ${packageName}@latest\n\n`
      );
    });
    return;
  }

  child.unref(); // 不阻塞父进程

  // 监听错误（spawn 成功但子进程立即报错，如 EACCES 权限）
  child.on?.('error', () => {
    process.stderr.write(
      `  ⚠️  后台自动升级失败（权限不足？）。请手动运行: npm install -g ${packageName}@latest\n\n`
    );
  });

  // 写缓存，记录已触发升级
  writeCache({ lastChecked: now, latestVersion: latest, upgradedVersion: latest });

  // 进程退出时打印简短通知
  process.on('exit', () => {
    process.stderr.write(`  🔄  Ethan 正在后台升级到 v${latest}，完成后重启终端生效。\n\n`);
  });
}

/**
 * 显式前台升级：查询 npm registry，有新版本则执行 npm install -g 并等待完成。
 * 供 `ethan upgrade` 命令使用，有实时输出，不静默。
 */
export async function checkAndPrintUpdate(
  currentVersion: string,
  packageName: string,
  force: boolean
): Promise<void> {
  const { spawnSync } = await import('child_process');

  console.log(`\n🔍  当前版本: v${currentVersion}`);
  process.stdout.write('    查询 npm registry...');

  let latest: string | null = null;
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as Record<string, string>;
    latest = typeof data.version === 'string' ? data.version : null;
  } catch {
    console.log(' ❌ 网络请求失败，请检查网络连接后重试\n');
    return;
  }

  if (!latest) {
    console.log(' ❌ 无法解析最新版本号\n');
    return;
  }

  console.log(` 最新版本: v${latest}`);

  if (!force && !compareVersions(currentVersion, latest)) {
    console.log('\n✅  已是最新版本，无需升级\n');
    return;
  }

  if (force) {
    console.log(`\n⚡  --force 模式：强制重新安装 v${latest}`);
  } else {
    console.log(`\n⬆️  发现新版本 v${latest}，开始升级...`);
  }

  const isWin = process.platform === 'win32';
  const npm = isWin ? 'npm.cmd' : 'npm';

  const result = spawnSync(npm, ['install', '-g', `${packageName}@latest`], {
    stdio: 'inherit',
    shell: isWin,
  });

  if (result.status === 0) {
    // 清除缓存，下次静默检查重新评估
    const now = Date.now();
    writeCache({ lastChecked: now, latestVersion: latest });
    console.log(`\n✅  升级成功！已安装 v${latest}，重启终端后生效\n`);
  } else {
    console.log(`\n❌  升级失败（exit code ${result.status ?? 'unknown'}）`);
    console.log(`    请尝试手动运行: npm install -g ${packageName}@latest\n`);
  }
}

/**
 * 当发现新版本时，向 stderr 打印一行可感知的 banner。
 */
function printUpdateBanner(currentVersion: string, latest: string, packageName: string): void {
  process.stderr.write(
    `\n  📦  ethan v${latest} 可用（当前 v${currentVersion}）— 运行 ethan upgrade 立即更新\n\n`
  );
}

/**
 * 后台静默检查更新，有新版本时：
 *   1. 打印 banner 提醒用户
 *   2. 触发后台 npm install（静默，不阻塞）
 */
export function checkForUpdates(currentVersion: string, packageName: string): void {
  const cache = readCache();
  const now = Date.now();

  // 使用缓存结果（未超过 24h）
  if (cache && now - cache.lastChecked < CHECK_INTERVAL_MS) {
    if (compareVersions(currentVersion, cache.latestVersion)) {
      printUpdateBanner(currentVersion, cache.latestVersion, packageName);
      autoUpgrade(packageName, cache.latestVersion, cache, now, currentVersion);
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
        printUpdateBanner(currentVersion, latest, packageName);
        autoUpgrade(packageName, latest, cache, now, currentVersion);
      }
    })
    .catch(() => {
      // 网络失败静默忽略
    });
}
