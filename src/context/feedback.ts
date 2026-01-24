/**
 * Feedback mechanism for transparency
 * 
 * Creates and manages .setu/feedback.md for user feedback on Setu behavior.
 * This supports Anthropic's transparency principle: users should understand
 * which behaviors are intended vs unintended.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const SETU_DIR = '.setu';
const FEEDBACK_FILE = 'feedback.md';

/**
 * Feedback entry structure
 */
export interface FeedbackEntry {
  timestamp: string;
  type: 'unexpected' | 'suggestion' | 'positive';
  description: string;
  context?: string;
}

/**
 * Template for the feedback file
 */
const FEEDBACK_TEMPLATE = `# Setu Feedback

This file captures feedback on Setu's behavior to help improve future versions.

## How to Use

When Setu behaves unexpectedly (positively or negatively), add an entry below.
This helps the Setu team understand gaps between intention and reality.

**Types of feedback:**
- \`unexpected\`: Setu did something you didn't expect
- \`suggestion\`: Ideas for improvement
- \`positive\`: Things that worked well

---

## Feedback Entries

<!-- Add entries below using this format:
### [DATE] - [TYPE]
**Context:** What were you trying to do?
**Behavior:** What did Setu do?
**Expected:** What did you expect instead?
-->

`;

/**
 * Ensure a Setu metadata directory ('.setu') exists inside the given project directory.
 *
 * @param projectDir - Path to the project root where the '.setu' directory should be located
 * @returns The full path to the '.setu' directory
 */
export function ensureSetuDir(projectDir: string): string {
  const setuDir = join(projectDir, SETU_DIR);
  if (!existsSync(setuDir)) {
    mkdirSync(setuDir, { recursive: true });
  }
  return setuDir;
}

/**
 * Creates the feedback file if it doesn't exist
 * 
 * @param projectDir - Project root directory
 * @returns Path to the feedback file
 */
export function initializeFeedbackFile(projectDir: string): string {
  const setuDir = ensureSetuDir(projectDir);
  const feedbackPath = join(setuDir, FEEDBACK_FILE);
  
  if (!existsSync(feedbackPath)) {
    writeFileSync(feedbackPath, FEEDBACK_TEMPLATE, 'utf-8');
    console.log('[Setu] Created .setu/feedback.md for transparency');
  }
  
  return feedbackPath;
}

/**
 * Append a formatted feedback entry to the Setu feedback file.
 *
 * Ensures the feedback file exists and appends a Markdown entry containing the entry's
 * timestamp, type, optional context, and description.
 *
 * @param projectDir - Project root directory where the `.setu/feedback.md` file is stored
 * @param entry - Feedback entry to add
 */
export function appendFeedback(projectDir: string, entry: FeedbackEntry): void {
  const feedbackPath = initializeFeedbackFile(projectDir);
  
  const entryText = `
### ${entry.timestamp} - ${entry.type}
${entry.context ? `**Context:** ${entry.context}\n` : ''}**Description:** ${entry.description}

`;
  
  appendFileSync(feedbackPath, entryText, 'utf-8');
}

/**
 * Construct the expected full path to the Setu feedback file inside a project.
 *
 * @param projectDir - Path to the project root directory
 * @returns The full path to the feedback.md file located in the project's `.setu` directory
 */
export function getFeedbackPath(projectDir: string): string {
  return join(projectDir, SETU_DIR, FEEDBACK_FILE);
}

/**
 * Determines whether a Setu feedback file exists in the project's .setu directory.
 *
 * @param projectDir - Path to the project root
 * @returns `true` if the `feedback.md` file exists at `.setu/feedback.md` inside `projectDir`, `false` otherwise.
 */
export function hasFeedbackFile(projectDir: string): boolean {
  return existsSync(getFeedbackPath(projectDir));
}