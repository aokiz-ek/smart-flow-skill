import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  buildProjectSnapshot,
  formatSnapshotForPrompt,
  loadCachedSnapshot,
  saveSnapshotCache,
} from './builder';

describe('buildProjectSnapshot', () => {
  it('returns a snapshot with required fields', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    expect(snapshot.projectName).toBeTruthy();
    expect(typeof snapshot.techSummary).toBe('string');
    expect(Array.isArray(snapshot.frameworks)).toBe(true);
    expect(Array.isArray(snapshot.languages)).toBe(true);
    expect(Array.isArray(snapshot.tools)).toBe(true);
    expect(Array.isArray(snapshot.changedFiles)).toBe(true);
    expect(typeof snapshot.directoryTree).toBe('string');
    expect(typeof snapshot.generatedAt).toBe('string');
    expect(snapshot.cwd).toBe(process.cwd());
  });

  it('detects TypeScript in this project', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    expect(snapshot.languages).toContain('TypeScript');
  });

  it('detects Vitest in tools', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    expect(snapshot.tools).toContain('Vitest');
  });

  it('includes git branch for git repo', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    expect(snapshot.currentBranch).toBeTruthy();
  });

  it('includes directory tree', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    expect(snapshot.directoryTree).toContain('src');
  });

  it('falls back to dir basename for non-package project', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ethan-test-'));
    try {
      const snapshot = buildProjectSnapshot(tmpDir);
      expect(snapshot.projectName).toBe(path.basename(tmpDir));
      expect(snapshot.currentBranch).toBe(''); // not a git repo
      expect(snapshot.recentCommits).toBe('');
    } finally {
      fs.rmdirSync(tmpDir, { recursive: true } as any);
    }
  });
});

describe('formatSnapshotForPrompt', () => {
  const snapshot = buildProjectSnapshot(process.cwd());

  it('includes project name in Chinese output', () => {
    const text = formatSnapshotForPrompt(snapshot, false);
    expect(text).toContain(snapshot.projectName);
    expect(text).toContain('项目上下文');
  });

  it('includes project name in English output', () => {
    const text = formatSnapshotForPrompt(snapshot, true);
    expect(text).toContain(snapshot.projectName);
    expect(text).toContain('Project Context');
  });

  it('includes language info', () => {
    const text = formatSnapshotForPrompt(snapshot, false);
    expect(text).toContain('TypeScript');
  });

  it('includes branch info if available', () => {
    if (snapshot.currentBranch) {
      const text = formatSnapshotForPrompt(snapshot, false);
      expect(text).toContain(snapshot.currentBranch);
    }
  });
});

describe('cache: loadCachedSnapshot / saveSnapshotCache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ethan-cache-'));
  });

  afterEach(() => {
    fs.rmdirSync(tmpDir, { recursive: true } as any);
  });

  it('returns null when no cache file exists', () => {
    expect(loadCachedSnapshot(tmpDir)).toBeNull();
  });

  it('saves and loads a snapshot', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    saveSnapshotCache(snapshot, tmpDir);

    const loaded = loadCachedSnapshot(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.projectName).toBe(snapshot.projectName);
    expect(loaded!.cwd).toBe(snapshot.cwd);
  });

  it('returns null for expired cache', () => {
    const snapshot = buildProjectSnapshot(process.cwd());
    // Set generatedAt to 31 minutes ago
    const staleSnapshot = {
      ...snapshot,
      generatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };
    const cacheDir = path.join(tmpDir, '.ethan');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, 'context.json'),
      JSON.stringify(staleSnapshot, null, 2),
      'utf-8'
    );

    expect(loadCachedSnapshot(tmpDir)).toBeNull();
  });
});
