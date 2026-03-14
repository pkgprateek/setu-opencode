import { afterEach, describe, expect, test, mock } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createCompactionHook } from '../compaction';
import { createActiveTask, saveActiveTask } from '../../context/active';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

const createdDirs: string[] = [];

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'setu-compaction-'));
  mkdirSync(join(dir, '.setu'), { recursive: true });
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
});

describe('compaction hook containment', () => {
  test('injects active task context for exact Setu sessions', async () => {
    const projectDir = makeProjectDir();
    saveActiveTask(projectDir, createActiveTask('Finish containment work', []));

    const hook = createCompactionHook(
      () => projectDir,
      (sessionID) => (sessionID === 'session-setu' ? 'setu' : null)
    );
    const output = { context: [] as string[] };

    await hook({ sessionID: 'session-setu' }, output);

    expect(output.context.some((entry) => entry.includes('Active Task'))).toBe(true);
    expect(output.context.some((entry) => entry.includes('Finish containment work'))).toBe(true);
  });

  test('skips compaction injection for unknown or non-Setu sessions', async () => {
    const projectDir = makeProjectDir();
    saveActiveTask(projectDir, createActiveTask('Should stay hidden', []));

    const hook = createCompactionHook(
      () => projectDir,
      (sessionID) => {
        if (sessionID === 'session-build') return 'build';
        return null;
      }
    );

    const buildOutput = { context: [] as string[] };
    await hook({ sessionID: 'session-build' }, buildOutput);
    expect(buildOutput.context).toHaveLength(0);

    const unknownOutput = { context: [] as string[] };
    await hook({ sessionID: 'session-unknown' }, unknownOutput);
    expect(unknownOutput.context).toHaveLength(0);
  });
});
