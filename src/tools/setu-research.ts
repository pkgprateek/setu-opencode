import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ensureSetuDir } from '../context/storage';
import { getErrorMessage } from '../utils/error-handling';
import { createPromptSanitizer } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';

// Create sanitizers for different field lengths
const sanitizeSummary = createPromptSanitizer(5000);
const sanitizeConstraints = createPromptSanitizer(2000);
const sanitizePatterns = createPromptSanitizer(2000);
const sanitizeLearningsField = createPromptSanitizer(2000);

export const createSetuResearchTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Save research findings to .setu/RESEARCH.md. Call this when you understand the task.',
  args: {
    summary: tool.schema.string().describe('Summary of findings'),
    constraints: tool.schema.string().optional().describe('Discovered constraints'),
    patterns: tool.schema.string().optional().describe('Observed patterns'),
    learnings: tool.schema.string().optional().describe('What worked/failed')
  },
  async execute(args, _context) {
    const projectDir = getProjectDir();

    // Validate projectDir to prevent directory traversal
    try {
      validateProjectDir(projectDir);
    } catch (error) {
      throw new Error(`Invalid project directory: ${getErrorMessage(error)}`);
    }

    // Validate required fields
    if (!args.summary || typeof args.summary !== 'string' || args.summary.trim().length === 0) {
      throw new Error('summary is required and cannot be empty. Please provide a research summary before saving.');
    }

    // Sanitize inputs before persisting (content may be injected into prompts later)
    const sanitizedArgs = {
      summary: sanitizeSummary(args.summary),
      constraints: args.constraints ? sanitizeConstraints(args.constraints) : undefined,
      patterns: args.patterns ? sanitizePatterns(args.patterns) : undefined,
      learnings: args.learnings ? sanitizeLearningsField(args.learnings) : undefined
    };
    
    const content = formatResearch(sanitizedArgs);
    
    // Ensure .setu/ exists and write RESEARCH.md with error handling
    try {
      ensureSetuDir(projectDir);
      await writeFile(join(projectDir, '.setu', 'RESEARCH.md'), content);
    } catch (error) {
      throw new Error(`Failed to save research: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }
    
    return `Research saved. Gear shifted: scout → architect. You can now create PLAN.md.`;
  }
});

// NOTE: This is a populated template, not the empty RESEARCH_TEMPLATE.
// We keep it inline to avoid mixing placeholder comments with live content.
function formatResearch(args: {
  summary: string;
  constraints?: string;
  patterns?: string;
  learnings?: string;
}): string {
  return `# Research Summary

## Findings

${args.summary}

## Constraints

${args.constraints || 'None identified.'}

## Patterns Observed

${args.patterns || 'None identified.'}

## Learnings

${args.learnings || 'No specific learnings yet.'}

## Next Steps

Ready to create PLAN.md.
`;
}
