/**
 * Git utility helpers for Phase 1 commands (commit / review / pr / standup / changelog)
 * All git calls use spawnSync — no shell interpolation.
 */

import { spawnSync } from 'child_process';

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function git(args: string[], cwd?: string): GitResult {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    cwd: cwd || process.cwd(),
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

/** Check if cwd is inside a git repository */
export function isGitRepo(cwd?: string): boolean {
  return git(['rev-parse', '--git-dir'], cwd).ok;
}

/** Get staged diff (for commit message generation) */
export function getStagedDiff(cwd?: string): string {
  return git(['diff', '--staged'], cwd).stdout;
}

/** Get full diff (staged + unstaged) */
export function getFullDiff(cwd?: string): string {
  return git(['diff', 'HEAD'], cwd).stdout;
}

/** Get diff between two refs/branches */
export function getBranchDiff(base: string, head: string = 'HEAD', cwd?: string): string {
  return git(['diff', `${base}...${head}`], cwd).stdout;
}

/** Get staged file list */
export function getStagedFiles(cwd?: string): string[] {
  const r = git(['diff', '--staged', '--name-only'], cwd);
  return r.stdout ? r.stdout.split('\n').filter(Boolean) : [];
}

/** Get current branch name */
export function getCurrentBranch(cwd?: string): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).stdout || 'HEAD';
}

/** Get default/main branch (tries main then master) */
export function getDefaultBranch(cwd?: string): string {
  const branches = git(['branch', '-r'], cwd).stdout;
  if (branches.includes('origin/main')) return 'main';
  if (branches.includes('origin/master')) return 'master';
  return 'main';
}

/** Get commit log since a given time expression (e.g. "24 hours ago") */
export function getCommitLogSince(since: string, author?: string, cwd?: string): string {
  const args = ['log', `--since=${since}`, '--oneline', '--no-merges'];
  if (author) args.push(`--author=${author}`);
  return git(args, cwd).stdout;
}

/** Get commits between two tags/refs for changelog */
export function getCommitRange(from: string, to: string = 'HEAD', cwd?: string): string {
  return git(['log', `${from}..${to}`, '--oneline', '--no-merges'], cwd).stdout;
}

/** Get the latest tag */
export function getLatestTag(cwd?: string): string {
  return git(['describe', '--tags', '--abbrev=0'], cwd).stdout || '';
}

/** Get list of tags */
export function getTags(cwd?: string): string[] {
  const r = git(['tag', '--sort=-creatordate'], cwd);
  return r.stdout ? r.stdout.split('\n').filter(Boolean) : [];
}

/** Truncate diff to avoid flooding prompt — keep first N chars */
export function truncateDiff(diff: string, maxChars = 8000): string {
  if (diff.length <= maxChars) return diff;
  const truncated = diff.slice(0, maxChars);
  const lines = truncated.split('\n');
  lines.pop(); // drop partial line
  return lines.join('\n') + `\n\n[... diff truncated at ${maxChars} chars ...]`;
}
