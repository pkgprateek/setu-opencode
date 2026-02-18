import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createToolExecuteBeforeHook } from '../tool-execute';
import { clearDisciplineState, type ContextCollector, type SetuContext } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

// Helper to create a minimal valid SetuContext for testing
function createMockContext(filesRead: Array<{ path: string }>): SetuContext {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    confirmed: false,
    project: {},
    filesRead: filesRead.map(f => ({
      path: f.path,
      readAt: now,
    })),
    searchesPerformed: [],
    patterns: [],
  };
}

// Helper to create a minimal ContextCollector mock
function createMockCollector(filesRead: Array<{ path: string }>): ContextCollector {
  const context = createMockContext(filesRead);
  return {
    getContext: () => context,
    recordFileRead: () => {},
    recordSearch: () => {},
    addPattern: () => {},
    updateProjectInfo: () => {},
    confirm: () => {},
    reset: () => {},
    loadFromDisk: () => false,
    saveToDisk: () => {},
    debouncedSave: () => {},
  };
}

describe('tool-execute read-before-write guards', () => {
  let projectDir = '';
  let existingFile = '';
  let sessionID = '';

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'setu-overwrite-'));
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# research', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# plan', 'utf-8');
    existingFile = join(projectDir, 'hello.txt');
    writeFileSync(existingFile, 'hello', 'utf-8');
    sessionID = `overwrite-${Date.now()}`;
  });

  afterEach(() => {
    clearDisciplineState(sessionID);
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('blocks edit without prior read', async () => {
    const collector = createMockCollector([]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-1' },
        { args: { filePath: 'hello.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).rejects.toThrow('Wait:');
  });

  test('allows edit after file was read', async () => {
    const collector = createMockCollector([{ path: 'hello.txt' }]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-2' },
        { args: { filePath: 'hello.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).resolves.toBeUndefined();
  });

  test('blocks edit when file does not exist', async () => {
    const collector = createMockCollector([]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-3' },
        { args: { filePath: 'missing.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).rejects.toThrow('Wait:');
  });

  test('blocks path traversal attempts', async () => {
    const collector = createMockCollector([]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-traversal' },
        { args: { filePath: '../../../etc/passwd', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow('Path Security');
  });

  test('blocks absolute path outside project', async () => {
    const collector = createMockCollector([]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-abs' },
        { args: { filePath: '/etc/passwd', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow('Path Security');
  });

  test('blocks null byte injection in file path', async () => {
    // Create a file that the null byte attack would target if successful
    // (the path after the null byte: 'hello.txt.sh')
    const targetFile = join(projectDir, 'hello.txt.sh');
    writeFileSync(targetFile, 'original content', 'utf-8');

    const collector = createMockCollector([]);

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    // Even though 'hello.txt.sh' exists, the request with null byte should be rejected
    // This proves sanitizeArgs is removing the null byte AND the hook is blocking
    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-nullbyte' },
        { args: { filePath: 'hello.txt\x00.sh', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow();

    // Verify the target file was NOT modified (null byte bypass failed)
    const content = readFileSync(targetFile, 'utf-8');
    expect(content).toBe('original content');
  });
});
