import type { ActiveTask } from './types';

export type ArtifactMode = 'append' | 'remake';

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
}

function overlapScore(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common++;
  }

  return common / Math.max(left.size, right.size);
}

function parseFilePaths(fileEdits: string): string[] {
  return fileEdits
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .filter((line) => /[./\\]/.test(line));
}

export function decideResearchArtifactMode(input: {
  hasExistingResearch: boolean;
  activeTask: ActiveTask | null;
  summary: string;
}): ArtifactMode {
  if (!input.hasExistingResearch) return 'remake';
  if (!input.activeTask) return 'remake';
  if (input.activeTask.status !== 'in_progress') return 'remake';

  const score = overlapScore(input.activeTask.task, input.summary);
  return score >= 0.18 ? 'append' : 'remake';
}

export function decidePlanArtifactMode(input: {
  hasExistingPlan: boolean;
  existingPlanContent?: string;
  activeTask: ActiveTask | null;
  objective: string;
  fileEdits: string;
}): ArtifactMode {
  if (!input.hasExistingPlan) return 'remake';
  if (!input.activeTask) return 'remake';
  if (input.activeTask.status !== 'in_progress') return 'remake';

  const objectiveScore = overlapScore(input.activeTask.task, input.objective);
  if (objectiveScore < 0.18) return 'remake';

  const incomingFiles = parseFilePaths(input.fileEdits);
  if (incomingFiles.length === 0) return 'append';
  if (!input.existingPlanContent) return incomingFiles.length <= 2 ? 'append' : 'remake';

  const existing = input.existingPlanContent.toLowerCase();
  const newFiles = incomingFiles.filter((filePath) => !existing.includes(filePath.toLowerCase()));

  return newFiles.length <= 2 ? 'append' : 'remake';
}
