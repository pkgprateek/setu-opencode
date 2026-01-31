/**
 * setu_feedback tool - Capture user feedback on Setu behavior
 * 
 * This tool allows users (or the agent) to log feedback about
 * Setu's behavior for transparency and improvement.
 */

import { tool } from '@opencode-ai/plugin';
import { 
  appendFeedback, 
  initializeFeedbackFile, 
  incrementFeedbackCount,
  type FeedbackEntry 
} from '../context/feedback';
import { MAX_FEEDBACK_PER_SESSION } from '../constants';

export interface SetuFeedbackResult {
  success: boolean;
  message: string;
  feedbackPath: string;
}

/**
 * Creates the setu_feedback tool definition
 */
export function createSetuFeedbackTool(getProjectDir: () => string): ReturnType<typeof tool> {
  return tool({
    description: `Log feedback about Setu's behavior for transparency and improvement.

Use this tool to:
- Report unexpected behavior (positive or negative)
- Suggest improvements
- Note things that worked well

Feedback is saved to .setu/feedback.md for review.`,
    
    args: {
      type: tool.schema.enum(['unexpected', 'suggestion', 'positive']).describe(
        'Type of feedback: unexpected behavior, suggestion, or positive experience'
      ),
      description: tool.schema.string().describe(
        'Description of the behavior or suggestion'
      ),
      context: tool.schema.string().optional().describe(
        'What you were trying to do when this happened (optional)'
      )
    },
    
    async execute(args, context): Promise<string> {
      const projectDir = getProjectDir();
      const sessionID = context.sessionID || 'unknown';
      
      // Check rate limit BEFORE doing any work
      const rateCheck = incrementFeedbackCount(sessionID);
      
      if (!rateCheck.allowed) {
        return `**Feedback limit reached** (${MAX_FEEDBACK_PER_SESSION} per session)

Your feedback matters! To submit more:
- Start a new session, or
- Open an issue at https://github.com/pkgprateek/setu-opencode/issues`;
      }
      
      try {
        // Ensure feedback file exists
        initializeFeedbackFile(projectDir);
        
        // Create feedback entry
        const entry: FeedbackEntry = {
          timestamp: new Date().toISOString().split('T')[0],
          type: args.type as 'unexpected' | 'suggestion' | 'positive',
          description: args.description,
          context: args.context
        };
        
        // Append to feedback file
        appendFeedback(projectDir, entry);
        
        return `**Feedback recorded** (${args.type})

Thank you! Saved to \`.setu/feedback.md\`.
(${rateCheck.remaining} submission${rateCheck.remaining !== 1 ? 's' : ''} remaining this session)`;
      } catch (error) {
        return `Failed to record feedback: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  });
}
