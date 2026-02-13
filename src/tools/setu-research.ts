import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { ensureSetuDir } from '../context/storage';
import { loadActiveTask } from '../context/active';
import { decideResearchArtifactMode, setQuestionBlocked } from '../context';
import { getErrorMessage } from '../utils/error-handling';
import { removeControlChars, removeInstructionBoundaries, removeSystemPatterns } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';

const MAX_INLINE_RESEARCH_CHARS = 120_000;
const CHUNK_SIZE_CHARS = 40_000;

function sanitizeResearchText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return [removeControlChars, removeSystemPatterns, removeInstructionBoundaries]
    .reduce((acc, fn) => fn(acc), input)
    .trim();
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

  for (let i = 0; i < chunks.length; i++) {
    const partPath = join(chunksDir, `research.part-${String(i + 1).padStart(2, '0')}.md`);
    await writeFile(partPath, chunks[i]);
  }

  return chunks.length;
}

export const createSetuResearchTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Save research findings to .setu/RESEARCH.md. Call this when you understand the task.',
  args: {
    summary: tool.schema.string().describe('Research findings in markdown format. Include codebase analysis, patterns found, and relevant context.'),
    constraints: tool.schema.string().optional().describe('Discovered constraints, limitations, or technical debt'),
    patterns: tool.schema.string().optional().describe('Observed patterns in the codebase (architecture, naming, testing)'),
    learnings: tool.schema.string().optional().describe('What worked/failed during research'),
    openQuestions: tool.schema.string().optional().describe('Unresolved questions needing user input (e.g., stack choice, deployment target)')
  },
  async execute(args, context) {
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
      summary: sanitizeResearchText(args.summary),
      constraints: args.constraints ? sanitizeResearchText(args.constraints) : undefined,
      patterns: args.patterns ? sanitizeResearchText(args.patterns) : undefined,
      learnings: args.learnings ? sanitizeResearchText(args.learnings) : undefined,
      openQuestions: (args.openQuestions && typeof args.openQuestions === 'string' && args.openQuestions.trim().length > 0)
        ? sanitizeResearchText(args.openQuestions)
        : undefined
    };

    if (!sanitizedArgs.summary) {
      throw new Error('summary cannot be empty after sanitization');
    }

    const researchPath = join(projectDir, '.setu', 'RESEARCH.md');
    let existingResearch = '';
    let researchMode: 'append' | 'remake' = 'remake';

    try {
      const activeTask = loadActiveTask(projectDir);
      const researchExists = existsSync(researchPath);
      if (researchExists) {
        existingResearch = readFileSync(researchPath, 'utf-8');
      }

      researchMode = decideResearchArtifactMode({
        hasExistingResearch: researchExists,
        activeTask,
        summary: sanitizedArgs.summary,
      });
    } catch {
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
        chunkCount = await persistResearchChunks(projectDir, content);
        content += `\n## Persistence Notes\n\nResearch exceeded inline threshold and was persisted in ${chunkCount} chunk files under .setu/research_chunks/.\n`;
      }

      await writeFile(researchPath, content);
    } catch (error) {
      throw new Error(`Failed to save research: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }

    if (sanitizedArgs.openQuestions && sanitizedArgs.openQuestions.trim().length > 0) {
      if (context?.sessionID) {
        setQuestionBlocked(
          context.sessionID,
          `Research has open questions that need answers before planning:\n${sanitizedArgs.openQuestions}`
        );
        return 'Research saved. Open questions detected - resolve with question tool (if available) or setu_context before proceeding to setu_plan.';
      }
      throw new Error('Cannot save research with open questions: session ID unavailable for gating. This is a bug — please report it.');
    }

    return `Research ${researchMode === 'append' ? 'updated (append mode)' : 'saved (remake mode)'}. Gear shifted: scout -> architect. You can now create PLAN.md.`;
  }
});

function formatResearch(args: {
  summary: string;
  constraints?: string;
  patterns?: string;
  learnings?: string;
  openQuestions?: string;
}): string {
  let content = `# Research Summary

## Scope / Objective Understanding

${args.summary.split(/\r?\n/).slice(0, 6).join('\n')}

## Findings

${args.summary}
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

  const risks = args.learnings ? toBulletedListFromLines(args.learnings) : '- No explicit risks recorded yet.';
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
