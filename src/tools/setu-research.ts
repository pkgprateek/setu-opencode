import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { mkdir, writeFile, readdir, unlink, readFile } from 'fs/promises';
import { ensureSetuDir } from '../context/storage';
import { getErrorMessage } from '../utils/error-handling';
import { removeControlChars, removeInstructionBoundaries, removeSystemPatterns } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';
import { debugLog } from '../debug';
import { RESEARCH_TOOL_EXPECTATIONS } from '../prompts/contracts';

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

async function persistResearchChunks(projectDir: string, content: string): Promise<number> {
  const chunks = splitResearchContent(content, CHUNK_SIZE_CHARS);
  const chunksDir = join(projectDir, '.setu', 'research_chunks');
  await mkdir(chunksDir, { recursive: true });

  const chunkFileRegex = /^research\.part-\d{2,}\.md$/;
  try {
    const files = await readdir(chunksDir);
    const staleFiles = files.filter((file) => chunkFileRegex.test(file));
    await Promise.all(staleFiles.map((file) => unlink(join(chunksDir, file))));
    if (staleFiles.length > 0) {
      debugLog(`setu_research: deleted ${staleFiles.length} stale chunk file(s) in ${chunksDir}`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
        debugLog(`persistResearchChunks: ignoring cleanup error (${error.code})`);
      } else {
        throw new Error(`Failed to clean up stale research chunks: ${getErrorMessage(error)}`);
      }
    } else {
      throw new Error(`Failed to clean up stale research chunks: ${getErrorMessage(error)}`);
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const partPath = join(chunksDir, `research.part-${String(i + 1).padStart(2, '0')}.md`);
    await writeFile(partPath, chunks[i]);
  }

  debugLog(`setu_research: wrote ${chunks.length} chunk file(s) in ${chunksDir}`);

  return chunks.length;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export const createSetuResearchTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: RESEARCH_TOOL_EXPECTATIONS,
  args: {
    content: tool.schema.string().describe('Full research content in markdown format'),
    openQuestions: tool.schema.string().optional().describe('Unresolved questions (workflow-only, not persisted)'),
    mode: tool.schema.enum(['append', 'remake', 'auto']).optional().describe('Explicit mode or auto-detect')
  },
  async execute(args): Promise<string> {
    if (!args.content?.trim()) {
      throw new Error('content is required');
    }

    const projectDir = getProjectDir();
    validateProjectDir(projectDir);

    const sanitizedContent = sanitizeResearchText(args.content);
    const sanitizedQuestions = args.openQuestions ? normalizeOpenQuestions(args.openQuestions) : undefined;

    if (!sanitizedContent) {
      throw new Error('content cannot be empty after sanitization');
    }

    const researchPath = join(projectDir, '.setu', 'RESEARCH.md');
    let mode = args.mode ?? 'auto';
    let existingContent: string | undefined;

    if (mode === 'auto') {
      try {
        existingContent = await readFile(researchPath, 'utf-8');
        mode = 'append';
      } catch (e) {
        if (isNodeError(e) && e.code === 'ENOENT') {
          mode = 'remake';
        } else {
          throw e;
        }
      }
    } else if (mode === 'append') {
      try {
        existingContent = await readFile(researchPath, 'utf-8');
      } catch (e) {
        if (isNodeError(e) && e.code === 'ENOENT') {
          throw new Error('Cannot append: RESEARCH.md does not exist');
        }
        throw e;
      }
    }

    debugLog(`setu_research: mode=${mode}`);

    ensureSetuDir(projectDir);

    let content: string;
    if (mode === 'append') {
      const sanitizedExisting = sanitizeResearchText(existingContent ?? '');
      content = `${sanitizedExisting.trimEnd()}\n\n---\n\n## Session Addendum (${new Date().toISOString()})\n\n${sanitizedContent}`;
    } else {
      content = sanitizedContent;
    }

    if (content.length > MAX_INLINE_RESEARCH_CHARS) {
      const chunks = await persistResearchChunks(projectDir, content);
      content = `# Research Summary\n\nFull research (${content.length} chars) in ${chunks} chunks under .setu/research_chunks/`;
    }

    await writeFile(researchPath, content);
    debugLog(`setu_research: wrote ${content.length} chars to ${researchPath}`);

    if (sanitizedQuestions) {
      return `Research saved. Open questions need resolution:\n${sanitizedQuestions}\n\nResolve these before proceeding to PLAN.md.`;
    }

    return `Research ${mode === 'append' ? 'updated' : 'saved'}.`;
  }
});
