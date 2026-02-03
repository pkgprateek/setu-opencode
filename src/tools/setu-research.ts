import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ensureSetuDir } from '../context/storage';
import { sanitizeForPrompt } from '../security/prompt-sanitization';

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
    
    // Sanitize inputs before persisting (content may be injected into prompts later)
    const sanitizedArgs = {
      summary: sanitizeForPrompt(args.summary, 5000),
      constraints: args.constraints ? sanitizeForPrompt(args.constraints, 2000) : undefined,
      patterns: args.patterns ? sanitizeForPrompt(args.patterns, 2000) : undefined,
      learnings: args.learnings ? sanitizeForPrompt(args.learnings, 2000) : undefined
    };
    
    const content = formatResearch(sanitizedArgs);
    
    // Ensure .setu/ exists and write RESEARCH.md with error handling
    try {
      ensureSetuDir(projectDir);
      await writeFile(join(projectDir, '.setu', 'RESEARCH.md'), content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to save research: ${msg}. Check .setu/ directory permissions.`;
    }
    
    return `Research saved. Gear shifted: scout → architect. You can now create PLAN.md.`;
  }
});

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
