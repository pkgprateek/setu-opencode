import { tool } from '@opencode-ai/plugin';
import { validateProjectDir } from '../utils/path-validation';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { resetProgress } from '../context/active';
import { ensureSetuDir } from '../context/storage';
import { clearResults } from '../context/results';
import { createPromptMultilineSanitizer } from '../utils/sanitization';
import { debugLog } from '../debug';
import { PLAN_TOOL_EXPECTATIONS } from '../prompts/contracts';
import { getErrorMessage } from '../utils/error-handling';

const sanitizeObjective = createPromptMultilineSanitizer(200);

function sanitizePlanContent(input: string): string {
  if (!input || typeof input !== 'string') return '';
  // Intentional policy: preserve model-authored markdown structure/content as-is,
  // stripping only control chars for filesystem safety.
  return input
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function safeResetProgress(projectDir: string): string | null {
  try {
    resetProgress(projectDir);
    return null;
  } catch (error) {
    debugLog('setu_plan: resetProgress failed:', error);
    return `progress reset failed (${getErrorMessage(error)})`;
  }
}

function safeClearResults(projectDir: string): string | null {
  try {
    clearResults(projectDir);
    return null;
  } catch (error) {
    debugLog('setu_plan: clearResults failed:', error);
    return `results cleanup failed (${getErrorMessage(error)})`;
  }
}

function extractPlanPreview(content: string): string {
  const firstMeaningfulLine = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0) ?? '';

  const normalized = firstMeaningfulLine
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export const createSetuPlanTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: PLAN_TOOL_EXPECTATIONS,
  args: {
    content: tool.schema.string().describe('Full plan content in markdown format'),
    objective: tool.schema.string().optional().describe('Objective for return message only'),
    mode: tool.schema.enum(['append', 'remake', 'auto']).optional().describe('Explicit mode or auto-detect')
  },
  async execute(args): Promise<string> {
    if (!args.content?.trim()) {
      throw new Error('content is required');
    }

    const projectDir = getProjectDir();
    validateProjectDir(projectDir);

    // RESEARCH.md precondition
    try {
      await readFile(join(projectDir, '.setu', 'RESEARCH.md'));
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        throw new Error('RESEARCH.md required. Run setu_research first.');
      }
      throw e;
    }

    const sanitizedContent = sanitizePlanContent(args.content);
    if (!sanitizedContent) {
      throw new Error('content is empty after sanitization');
    }

    const planPath = join(projectDir, '.setu', 'PLAN.md');
    let mode = args.mode ?? 'auto';
    let existingContent: string | null = null;

    // Single read to check existence and cache content, avoiding TOCTOU
    try {
      existingContent = await readFile(planPath, 'utf-8');
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        existingContent = null;
      } else {
        throw e;
      }
    }

    if (mode === 'auto') {
      mode = existingContent !== null ? 'append' : 'remake';
    } else if (mode === 'append') {
      if (existingContent === null) {
        throw new Error('Cannot append: PLAN.md does not exist');
      }
    }

    ensureSetuDir(projectDir);

    let content: string;
    if (mode === 'append') {
      const sanitizedExisting = sanitizePlanContent(existingContent!);
      content = `${sanitizedExisting.trimEnd()}\n\n---\n\n## Revision (${new Date().toISOString()})\n\n${sanitizedContent}`;
    } else {
      content = sanitizedContent;
    }

    await writeFile(planPath, content);

    const cleanupWarnings: string[] = [];
    if (mode === 'remake') {
      const progressWarning = safeResetProgress(projectDir);
      if (progressWarning) cleanupWarnings.push(progressWarning);

      const resultsWarning = safeClearResults(projectDir);
      if (resultsWarning) cleanupWarnings.push(resultsWarning);
    }

    const safeObjective = args.objective ? sanitizeObjective(args.objective) : '';
    const preview = safeObjective ? '' : extractPlanPreview(sanitizedContent);
    const warningSuffix = cleanupWarnings.length > 0
      ? ` Cleanup warning: ${cleanupWarnings.join('; ')}.`
      : '';
    return `Plan ${mode === 'append' ? 'revised' : 'created'}${safeObjective ? ': ' + safeObjective : ''}.${warningSuffix}${preview ? ` Ready to execute: ${preview}.` : ''} Reply "go" to start, or tell me what to adjust.`;
  }
});
