import { describe, expect, test } from 'bun:test';
import { decidePlanArtifactMode, decideResearchArtifactMode } from '../artifact-policy';

describe('artifact-policy', () => {
  test('research mode appends when active task aligns', () => {
    const mode = decideResearchArtifactMode({
      hasExistingResearch: true,
      activeTask: {
        task: 'Implement authentication middleware with JWT',
        constraints: [],
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      },
      summary: 'Researched JWT auth middleware and token validation paths.',
    });

    expect(mode).toBe('append');
  });

  test('research mode remakes when intent diverges', () => {
    const mode = decideResearchArtifactMode({
      hasExistingResearch: true,
      activeTask: {
        task: 'Implement authentication middleware with JWT',
        constraints: [],
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      },
      summary: 'Redesigning CSS component spacing and animation utilities.',
    });

    expect(mode).toBe('remake');
  });

  test('plan mode appends for small file delta', () => {
    const mode = decidePlanArtifactMode({
      hasExistingPlan: true,
      existingPlanContent: '## File-level Edit List\n- src/a.ts\n- src/b.ts\n',
      activeTask: {
        task: 'Implement JWT auth middleware',
        constraints: [],
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      },
      objective: 'Improve JWT auth middleware behavior',
      fileEdits: '- src/a.ts\n- src/c.ts',
    });

    expect(mode).toBe('append');
  });

  test('plan mode remakes for major file drift', () => {
    const mode = decidePlanArtifactMode({
      hasExistingPlan: true,
      existingPlanContent: '## File-level Edit List\n- src/a.ts\n',
      activeTask: {
        task: 'Implement JWT auth middleware',
        constraints: [],
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      },
      objective: 'Improve JWT auth middleware behavior',
      fileEdits: '- src/x.ts\n- src/y.ts\n- src/z.ts',
    });

    expect(mode).toBe('remake');
  });
});
