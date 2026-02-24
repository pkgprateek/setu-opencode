import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createSetuResearchTool, normalizeOpenQuestions, splitResearchContent } from '../setu-research';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ToolContext } from '@opencode-ai/plugin';
import { createMockToolContext } from './tool-context-fixtures';

describe('setu_research chunking', () => {
  test('splits large content into fixed-size chunks', () => {
    const input = 'a'.repeat(95);
    const chunks = splitResearchContent(input, 40);

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(40);
    expect(chunks[1].length).toBe(40);
    expect(chunks[2].length).toBe(15);
  });

  test('chunks reassemble to original content', () => {
    const input = 'The quick brown fox jumps over the lazy dog. ';
    const chunks = splitResearchContent(input, 10);
    expect(chunks.join('')).toBe(input);
  });

  test('throws for invalid chunk size', () => {
    expect(() => splitResearchContent('abc', 0)).toThrow('chunkSize must be positive');
    expect(() => splitResearchContent('abc', -1)).toThrow('chunkSize must be positive');
  });
});

describe('setu_research open question normalization', () => {
  test('treats sentinel values as no open questions', () => {
    expect(normalizeOpenQuestions('None')).toBeUndefined();
    expect(normalizeOpenQuestions('N/A')).toBeUndefined();
    expect(normalizeOpenQuestions('no open questions')).toBeUndefined();
    expect(normalizeOpenQuestions('- none')).toBeUndefined();
  });

  test('preserves meaningful open question content', () => {
    const normalized = normalizeOpenQuestions('Should this be txt or md?');
    expect(normalized).toBe('Should this be txt or md?');
  });
});

describe('setu_research content-first API', () => {
  let testDir: string;
  let tool: ReturnType<typeof createSetuResearchTool>;
  let mockContext: ToolContext;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setu-research-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, '.setu'), { recursive: true });
    tool = createSetuResearchTool(() => testDir);
    mockContext = createMockToolContext();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  test('writes content verbatim on remake', async () => {
    const content = '# Research\n\n## Intent\nBuild T4 Canvas.';
    const result = await tool.execute({ content, mode: 'remake' }, mockContext);

    expect(result).toContain('Research saved');
    const saved = await readFile(join(testDir, '.setu', 'RESEARCH.md'), 'utf-8');
    expect(saved).toBe(content);
  });

  test('auto mode appends when RESEARCH.md exists', async () => {
    await tool.execute({ content: '# First', mode: 'remake' }, mockContext);
    const result = await tool.execute({ content: '# Second', mode: 'auto' }, mockContext);

    expect(result).toContain('Research updated');
    const saved = await readFile(join(testDir, '.setu', 'RESEARCH.md'), 'utf-8');
    expect(saved).toContain('# First');
    expect(saved).toContain('# Second');
    expect(saved).toContain('## Session Addendum (');
  });

  test('append mode fails when RESEARCH.md does not exist', async () => {
    await expect(tool.execute({ content: '# Orphan', mode: 'append' }, mockContext)).rejects.toThrow(
      'Cannot append: RESEARCH.md does not exist'
    );
  });

  test('both existing and appended content are sanitized on append', async () => {
    await writeFile(join(testDir, '.setu', 'RESEARCH.md'), 'Existing [SYSTEM] content');
    const result = await tool.execute({ content: '# New [SYSTEM] material', mode: 'append' }, mockContext);
    expect(result).toContain('Research updated');

    const saved = await readFile(join(testDir, '.setu', 'RESEARCH.md'), 'utf-8');
    expect(saved).not.toContain('[SYSTEM]');
    expect(saved).toContain('[FILTERED]');
    expect(saved).toContain('Existing [FILTERED] content');
    expect(saved).toContain('# New [FILTERED] material');
  });

  test('openQuestions appears in return message but is not persisted automatically', async () => {
    const result = await tool.execute(
      {
        content: '# Research body',
        openQuestions: 'Should we support SSR?',
        mode: 'remake',
      },
      mockContext
    );

    expect(result).toContain('Open questions need resolution');
    expect(result).toContain('Should we support SSR?');

    const saved = await readFile(join(testDir, '.setu', 'RESEARCH.md'), 'utf-8');
    expect(saved).toBe('# Research body');
  });
});
