import type { ActiveTask } from './types';
import { normalize } from 'path';

export type ArtifactMode = 'append' | 'remake';

/**
 * Threshold for determining whether to append or remake artifacts.
 * If the overlap score between active task and new content is >= this value,
 * we append; otherwise, we remake.
 */
const OVERLAP_APPEND_THRESHOLD = 0.18;

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
    .filter((line) => {
      // Tighten heuristic: require path separator OR file extension
      // This excludes lines like "Fix the bug." while keeping "src/foo/bar.ts" and "README.md"
      return /[/\\]/.test(line) || /\.[a-zA-Z0-9]{1,6}$/.test(line);
    });
}

function normalizePathForComparison(filePath: string): string {
  return normalize(filePath).replace(/\\/g, '/').toLowerCase();
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
  return score >= OVERLAP_APPEND_THRESHOLD ? 'append' : 'remake';
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
  if (objectiveScore < OVERLAP_APPEND_THRESHOLD) return 'remake';

  const incomingFiles = parseFilePaths(input.fileEdits);
  if (incomingFiles.length === 0) return 'append';
  if (!input.existingPlanContent) return incomingFiles.length <= 2 ? 'append' : 'remake';

  const existingPaths = parseFilePaths(input.existingPlanContent);
  const existingSet = new Set(existingPaths.map((filePath) => normalizePathForComparison(filePath)));
  const newFiles = incomingFiles.filter(
    (filePath) => !existingSet.has(normalizePathForComparison(filePath))
  );

  return newFiles.length <= 2 ? 'append' : 'remake';
}
