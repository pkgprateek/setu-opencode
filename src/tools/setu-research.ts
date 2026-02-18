import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { mkdir, writeFile, readdir, unlink, readFile } from 'fs/promises';
import { ensureSetuDir } from '../context/storage';
import { loadActiveTask } from '../context/active';
import { decideResearchArtifactMode } from '../context';
import { getErrorMessage } from '../utils/error-handling';
import { removeControlChars, removeInstructionBoundaries, removeSystemPatterns } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';
import { debugLog } from '../debug';

const MAX_INLINE_RESEARCH_CHARS = 120_000;
const CHUNK_SIZE_CHARS = 40_000;

function sanitizeResearchText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return [removeControlChars, removeSystemPatterns, removeInstructionBoundaries]
    .reduce((acc, fn) => fn(acc), input)
    .trim();
}

const OPEN_QUESTIONS_SENTINEL_PATTERN = /^(?:[-*\d.)\s]*)?(?:none|n\/a|na|nil|null|no(?:\s+open)?\s+questions?)(?:[\s:.-].*)?$/i;

export function normalizeOpenQuestions(input?: string): string | undefined {
  if (!input || typeof input !== 'string') return undefined;

  const sanitized = sanitizeResearchText(input);
  if (!sanitized) return undefined;

  const meaningfulLines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !OPEN_QUESTIONS_SENTINEL_PATTERN.test(line));

  if (meaningfulLines.length === 0) {
    return undefined;
  }

  return meaningfulLines.join('\n');
}

export function splitResearchContent(input: string, chunkSize = CHUNK_SIZE_CHARS): string[] {
  if (chunkSize <= 0) throw new Error('chunkSize must be positive');
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }
  return chunks;
}

function toBulletedListFromLines(input: string): string {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return '- N/A';
  return lines.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n');
}

async function persistResearchChunks(projectDir: string, content: string): Promise<number> {
  const chunks = splitResearchContent(content, CHUNK_SIZE_CHARS);
  const chunksDir = join(projectDir, '.setu', 'research_chunks');
  await mkdir(chunksDir, { recursive: true });

  // Clean up stale chunk files from previous runs
  try {
    const files = await readdir(chunksDir);
    const staleFiles = files.filter(
      (file) => file.startsWith('research.part-') && file.endsWith('.md')
    );
    for (const file of staleFiles) {
      await unlink(join(chunksDir, file));
    }
  } catch {
    // Directory might not exist yet or other error - safe to continue
  }

  for (let i = 0; i < chunks.length; i++) {
    const partPath = join(chunksDir, `research.part-${String(i + 1).padStart(2, '0')}.md`);
    await writeFile(partPath, chunks[i]);
  }

  return chunks.length;
}

export const createSetuResearchTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Save research findings to .setu/RESEARCH.md. Call this when you understand the task.',
  args: {
    task: tool.schema.string().optional().describe('Research task description - what you are investigating'),
    summary: tool.schema.string().describe('Research findings in markdown format. Include codebase analysis, patterns found, and relevant context.'),
    constraints: tool.schema.string().optional().describe('Discovered constraints, limitations, or technical debt'),
    patterns: tool.schema.string().optional().describe('Observed patterns in the codebase (architecture, naming, testing)'),
    learnings: tool.schema.string().optional().describe('What worked/failed during research'),
    risks: tool.schema.string().optional().describe('Known risks/unknowns discovered during research'),
    openQuestions: tool.schema.string().optional().describe('Unresolved questions needing user input (e.g., stack choice, deployment target)')
  },
  async execute(args) {
    const projectDir = getProjectDir();

    try {
      validateProjectDir(projectDir);
    } catch (error) {
      throw new Error(`Invalid project directory: ${getErrorMessage(error)}`);
    }

    if (!args.summary || typeof args.summary !== 'string' || args.summary.trim().length === 0) {
      throw new Error('summary is required and cannot be empty. Please provide a research summary before saving.');
    }

    const sanitizedArgs = {
      task: args.task ? sanitizeResearchText(args.task) : undefined,
      summary: sanitizeResearchText(args.summary),
      constraints: args.constraints ? sanitizeResearchText(args.constraints) : undefined,
      patterns: args.patterns ? sanitizeResearchText(args.patterns) : undefined,
      learnings: args.learnings ? sanitizeResearchText(args.learnings) : undefined,
      risks: args.risks ? sanitizeResearchText(args.risks) : undefined,
      openQuestions: normalizeOpenQuestions(args.openQuestions)
    };

    if (!sanitizedArgs.summary) {
      throw new Error('summary cannot be empty after sanitization');
    }

    const researchPath = join(projectDir, '.setu', 'RESEARCH.md');
    let existingResearch = '';
    let researchMode: 'append' | 'remake' = 'remake';

    try {
      const activeTask = loadActiveTask(projectDir);
      // Async read for existing research
      try {
        existingResearch = await readFile(researchPath, 'utf-8');
      } catch {
        existingResearch = '';
      }
      const hasExistingResearch = existingResearch.length > 0;

      researchMode = decideResearchArtifactMode({
        hasExistingResearch,
        activeTask,
        summary: sanitizedArgs.summary,
      });
    } catch (error) {
      debugLog(`Failed to evaluate research artifact mode; defaulting to remake: ${getErrorMessage(error)}`);
      researchMode = 'remake';
    }

    const baseContent = formatResearch(sanitizedArgs);
    let content = researchMode === 'append' && existingResearch
      ? `${existingResearch.trimEnd()}\n\n## Session Addendum (${new Date().toISOString()})\n\n${baseContent}`
      : baseContent;

    try {
      ensureSetuDir(projectDir);

      let chunkCount = 0;
      if (content.length > MAX_INLINE_RESEARCH_CHARS) {
        const originalLength = content.length;
        chunkCount = await persistResearchChunks(projectDir, content);
        content = `# Research Summary\n\n> Full research payload (${originalLength} chars) persisted in ${chunkCount} chunk files under .setu/research_chunks/\n\nSee chunk files for complete research content.`;
      }

      await writeFile(researchPath, content);
    } catch (error) {
      throw new Error(`Failed to save research: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }

    if (sanitizedArgs.openQuestions && sanitizedArgs.openQuestions.trim().length > 0) {
      return `Research saved. Open questions need resolution:\n${sanitizedArgs.openQuestions}\n\nResolve these questions with the user, then call setu_plan.`;
    }

    return `Research ${researchMode === 'append' ? 'updated (append mode)' : 'saved (remake mode)'}. Gear shifted: scout -> architect. You can now create PLAN.md.`;
  }
});

function formatResearch(args: {
  task?: string;
  summary: string;
  constraints?: string;
  patterns?: string;
  learnings?: string;
  risks?: string;
  openQuestions?: string;
}): string {
  const summaryLines = args.summary.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // Use task as scope line if provided, otherwise use first line of summary
  const scopeLine = args.task?.trim() || summaryLines[0] || args.summary.trim();
  const findingsBody = summaryLines.slice(1).join('\n');
  const findings = findingsBody.trim().length > 0
    ? findingsBody
    : '- No additional findings beyond scope for this simple task.';

  let content = `# Research Summary

## Scope / Objective Understanding

${scopeLine}

## Findings

${findings}
`;

  if (args.constraints) content += `
## Constraints

${args.constraints}
`;
  if (args.patterns) content += `
## Patterns Observed

${args.patterns}
`;
  if (args.learnings) content += `
## Learnings

${args.learnings}
`;

  const risks = args.risks ? toBulletedListFromLines(args.risks) : '- No explicit risks recorded yet.';
  content += `
## Risks / Unknowns

${risks}
`;

  if (args.openQuestions) content += `
## Open Decisions

${args.openQuestions}
`;

  content += args.openQuestions
    ? `
## Recommended Next Action

Resolve open questions before proceeding to PLAN.md.
`
    : `
## Recommended Next Action

Ready to create PLAN.md.
`;

  return content;
}
