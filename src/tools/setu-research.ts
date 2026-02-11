import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ensureSetuDir } from '../context/storage';
import { setQuestionBlocked } from '../context';
import { getErrorMessage } from '../utils/error-handling';
import { createPromptSanitizer } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';

// Create sanitizers for different field lengths
const sanitizeSummary = createPromptSanitizer(5000);
const sanitizeConstraints = createPromptSanitizer(2000);
const sanitizePatterns = createPromptSanitizer(2000);
const sanitizeLearningsField = createPromptSanitizer(2000);
const sanitizeOpenQuestions = createPromptSanitizer(2000);

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
      learnings: args.learnings ? sanitizeLearningsField(args.learnings) : undefined,
      openQuestions: args.openQuestions ? sanitizeOpenQuestions(args.openQuestions) : undefined
    };
    
    const content = formatResearch(sanitizedArgs);
    
    // Ensure .setu/ exists and write RESEARCH.md with error handling
    try {
      ensureSetuDir(projectDir);
      await writeFile(join(projectDir, '.setu', 'RESEARCH.md'), content);
    } catch (error) {
      throw new Error(`Failed to save research: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }
    
    if (sanitizedArgs.openQuestions && sanitizedArgs.openQuestions.trim().length > 0) {
      if (context?.sessionID) {
        setQuestionBlocked(
          context.sessionID,
          `Research has open questions that need answers before planning:\n${sanitizedArgs.openQuestions}`
        );
        return 'Research saved. Open questions detected - use the question tool to ask the user before proceeding to setu_plan.';
      } else {
        return 'Research saved. WARNING: Open questions detected but session ID unavailable — questions were not gated. Use the question tool to resolve before proceeding to setu_plan.';
      }
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
  openQuestions?: string;
}): string {
  let content = `# Research Summary

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
  if (args.openQuestions) content += `
## Open Questions

${args.openQuestions}
`;

  content += `
## Next Steps

Ready to create PLAN.md.
`;

  return content;
}
