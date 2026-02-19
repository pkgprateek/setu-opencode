import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createSetuPlanTool } from '../setu-plan';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ToolContext } from '@opencode-ai/plugin';

// Minimal mock ToolContext for unit tests
function createMockToolContext(): ToolContext {
  return {
    sessionID: 'test-session',
    messageID: 'test-msg-1',
    agent: 'setu',
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
  };
}

describe('setu_plan', () => {
  let testDir: string;
  let getProjectDir: () => string;
  let tool: ReturnType<typeof createSetuPlanTool>;
  let mockContext: ToolContext;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setu-plan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, '.setu'), { recursive: true });
    
    // Create RESEARCH.md precondition
    await writeFile(join(testDir, '.setu', 'RESEARCH.md'), '# Test Research\n\nFindings here.');
    
    getProjectDir = () => testDir;
    tool = createSetuPlanTool(getProjectDir);
    mockContext = createMockToolContext();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('content-first API', () => {
    test('accepts single content argument', async () => {
      const result = await tool.execute({ content: '# Test Plan\n\nStep 1: Do something' }, mockContext);
      expect(result).toContain('Plan created');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toContain('Step 1: Do something');
    });

    test('rejects empty content', async () => {
      await expect(tool.execute({ content: '' }, mockContext)).rejects.toThrow('content is required');
      await expect(tool.execute({ content: '   ' }, mockContext)).rejects.toThrow('content is required');
    });

    test('content with only whitespace is rejected', async () => {
      await expect(tool.execute({ content: '\n\t  \n' }, mockContext)).rejects.toThrow('content is required');
    });
  });

  describe('RESEARCH.md precondition', () => {
    test('fails if RESEARCH.md does not exist', async () => {
      await rm(join(testDir, '.setu', 'RESEARCH.md'));
      
      await expect(
        tool.execute({ content: '# Plan without research' }, mockContext)
      ).rejects.toThrow('RESEARCH.md required');
    });

    test('succeeds when RESEARCH.md exists', async () => {
      const result = await tool.execute({ content: '# Valid Plan' }, mockContext);
      expect(result).toContain('Plan created');
    });
  });

  describe('mode behavior', () => {
    test('remake mode creates new plan', async () => {
      await tool.execute({ content: '# First Plan', mode: 'remake' }, mockContext);
      
      const result = await tool.execute({ content: '# Second Plan', mode: 'remake' }, mockContext);
      expect(result).toContain('Plan created');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toBe('# Second Plan');
      expect(saved).not.toContain('First Plan');
    });

    test('append mode adds revision header', async () => {
      await tool.execute({ content: '# Original Plan', mode: 'remake' }, mockContext);
      
      const result = await tool.execute({ content: '# Updated Section', mode: 'append' }, mockContext);
      expect(result).toContain('Plan revised');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toContain('Original Plan');
      expect(saved).toContain('Updated Section');
      expect(saved).toContain('## Revision (');
      expect(saved).toContain('---');
    });

    test('append mode fails if plan does not exist', async () => {
      await expect(
        tool.execute({ content: '# Orphan Append', mode: 'append' }, mockContext)
      ).rejects.toThrow('Cannot append: PLAN.md does not exist');
    });

    test('auto mode creates when no plan exists', async () => {
      const result = await tool.execute({ content: '# Auto Created Plan', mode: 'auto' }, mockContext);
      expect(result).toContain('Plan created');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toBe('# Auto Created Plan');
    });

    test('auto mode appends when plan exists', async () => {
      await tool.execute({ content: '# First', mode: 'auto' }, mockContext);
      const result = await tool.execute({ content: '# Second', mode: 'auto' }, mockContext);
      
      expect(result).toContain('Plan revised');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toContain('First');
      expect(saved).toContain('Second');
      expect(saved).toContain('## Revision (');
    });

    test('default mode is auto', async () => {
      const result1 = await tool.execute({ content: '# First Plan' }, mockContext);
      expect(result1).toContain('Plan created');
      
      const result2 = await tool.execute({ content: '# Second Plan' }, mockContext);
      expect(result2).toContain('Plan revised');
    });
  });

  describe('content preservation', () => {
    test('content is not truncated (no cap)', async () => {
      const largeContent = '# Large Plan\n\n' + 'x'.repeat(50000);
      
      await tool.execute({ content: largeContent, mode: 'remake' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved.length).toBeGreaterThan(50000);
      expect(saved).toContain('x'.repeat(100));
    });

    test('control characters are removed from content', async () => {
      const contentWithControl = 'Plan\x00with\x01control\x02chars';
      
      await tool.execute({ content: contentWithControl, mode: 'remake' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).not.toContain('\x00');
      expect(saved).not.toContain('\x01');
      expect(saved).not.toContain('\x02');
      expect(saved).toContain('Plan');
      expect(saved).toContain('with');
      expect(saved).toContain('control');
      expect(saved).toContain('chars');
    });

    test('existing content is sanitized during append', async () => {
      // Create plan with control chars
      await writeFile(join(testDir, '.setu', 'PLAN.md'), 'Original\x00Content');
      
      await tool.execute({ content: '# New Section', mode: 'append' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).not.toContain('\x00');
      expect(saved).toContain('Original');
      expect(saved).toContain('Content');
      expect(saved).toContain('New Section');
    });

    test('content with only control chars is rejected after sanitization', async () => {
      await expect(tool.execute({ content: '\x01\x02\x03', mode: 'remake' }, mockContext)).rejects.toThrow(
        'content is empty after sanitization'
      );
    });
  });

  describe('objective handling', () => {
    test('objective appears in return message', async () => {
      const result = await tool.execute({ 
        content: '# Plan', 
        objective: 'Implement auth flow' 
      }, mockContext);
      expect(result).toContain('Implement auth flow');
    });

    test('objective is sanitized and truncated', async () => {
      const longObjective = 'x'.repeat(300);
      const result = await tool.execute({ 
        content: '# Plan', 
        objective: longObjective 
      }, mockContext);
      
      // Should be truncated to 200 chars
      expect(result.length).toBeLessThan(350);
    });

    test('control chars removed from objective', async () => {
      const result = await tool.execute({ 
        content: '# Plan', 
        objective: 'Auth\x00Flow' 
      }, mockContext);
      
      expect(result).not.toContain('\x00');
      expect(result).toContain('Auth');
      expect(result).toContain('Flow');
    });

    test('works without objective', async () => {
      const result = await tool.execute({ content: '# Plan' }, mockContext);
      expect(result).toBe('Plan created.');
    });
  });

  describe('remake mode clears state', () => {
    test('remake resets progress and results', async () => {
      // Create initial plan
      await tool.execute({ content: '# Plan v1', mode: 'remake' }, mockContext);
      
      // Simulate some progress with valid ActiveTask structure
      await mkdir(join(testDir, '.setu', 'results'), { recursive: true });
      await writeFile(join(testDir, '.setu', 'results', 'step-1.md'), 'result: done');
      await writeFile(join(testDir, '.setu', 'active.json'), JSON.stringify({
        task: 'Test task',
        startedAt: new Date().toISOString(),
        status: 'in_progress',
        constraints: [],
        progress: { lastCompletedStep: 5, lastCompletedAt: new Date().toISOString() }
      }));
      
      // Remake should clear these
      await tool.execute({ content: '# Plan v2', mode: 'remake' }, mockContext);
      
      // Progress should be reset (active.json updated)
      const active = await readFile(join(testDir, '.setu', 'active.json'), 'utf-8');
      const parsed = JSON.parse(active);
      expect(parsed.progress?.lastCompletedStep).toBe(0);
    });

    test('remake keeps plan write successful when results cleanup fails', async () => {
      await tool.execute({ content: '# Plan v1', mode: 'remake' }, mockContext);

      // Force clearResults failure: expected directory path becomes a file.
      await writeFile(join(testDir, '.setu', 'results'), 'not-a-directory');
      await writeFile(join(testDir, '.setu', 'results-old.md'), 'legacy-result');

      const result = await tool.execute({ content: '# Plan v2', mode: 'remake' }, mockContext);
      expect(result).toContain('Plan created');
      expect(result).toContain('Cleanup warning:');
      expect(result).toContain('results cleanup failed');

      // Primary source of truth remains updated.
      const savedPlan = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(savedPlan).toBe('# Plan v2');

      // Existing artifact at the results path remains (no destructive retry/overwrite).
      const resultsSentinel = await readFile(join(testDir, '.setu', 'results'), 'utf-8');
      expect(resultsSentinel).toBe('not-a-directory');

      // Existing non-results artifacts remain untouched when cleanup fails.
      const legacy = await readFile(join(testDir, '.setu', 'results-old.md'), 'utf-8');
      expect(legacy).toBe('legacy-result');
    });
  });

  describe('append preserves existing content', () => {
    test('append keeps prior content and adds new revision content', async () => {
      // Sequential behavior check: append path preserves prior PLAN.md content
      // and adds new revision content during tool.execute calls.
      await tool.execute({ content: '# Original', mode: 'remake' }, mockContext);
      
      const result = await tool.execute({ content: '# Addition', mode: 'append' }, mockContext);
      expect(result).toContain('Plan revised');
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toContain('Original');
      expect(saved).toContain('Addition');
    });
  });

  describe('edge cases', () => {
    test('handles content with markdown formatting', async () => {
      const markdownContent = `# Heading

## Subheading

- Item 1
- Item 2

\`\`\`typescript
const x = 1;
\`\`\`

> Quote block

**Bold** and *italic* text.`;

      await tool.execute({ content: markdownContent, mode: 'remake' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      expect(saved).toContain('## Subheading');
      expect(saved).toContain('```typescript');
      expect(saved).toContain('**Bold**');
    });

    test('handles multiline content with trailing newlines', async () => {
      const content = '# Plan\n\nStep 1\nStep 2\n\n';
      
      await tool.execute({ content, mode: 'remake' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      // Should trim trailing whitespace but preserve structure
      expect(saved).toContain('Step 1');
      expect(saved).toContain('Step 2');
    });

    test('revision timestamps are ISO format', async () => {
      await tool.execute({ content: '# First', mode: 'remake' }, mockContext);
      await tool.execute({ content: '# Second', mode: 'append' }, mockContext);
      
      const saved = await readFile(join(testDir, '.setu', 'PLAN.md'), 'utf-8');
      const match = saved.match(/## Revision \(([\d\-T:.Z]+)\)/);
      expect(match).toBeTruthy();
      
      // Verify it's a valid ISO date
      const date = new Date(match![1]);
      expect(date.getTime()).not.toBeNaN();
    });
  });
});
