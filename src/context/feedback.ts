/**
 * Feedback mechanism for transparency
 * 
 * Creates and manages .setu/feedback.md for user feedback on Setu behavior.
 * This supports Anthropic's transparency principle: users should understand
 * which behaviors are intended vs unintended.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug';
import { MAX_FEEDBACK_PER_SESSION } from '../constants';

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
    debugLog('Created .setu/feedback.md for transparency');
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

// ============================================================================
// Session Rate Limiting
// ============================================================================

/**
 * Session-scoped feedback count tracking.
 * Key: sessionID, Value: number of feedback entries submitted this session.
 * 
 * Why module-level Map?
 * - Session state isolated per sessionID
 * - No coupling to plugin state
 * - Cleaned up via clearSessionFeedback on session.deleted event
 */
const sessionFeedbackCounts = new Map<string, number>();

/**
 * Persistent rate limit metadata stored in .setu/feedback.meta.json
 */
interface FeedbackRateLimitMeta {
  dailyCount: number;
  dailyResetDate: string;  // YYYY-MM-DD
  totalCount: number;
}

const DAILY_FEEDBACK_LIMIT = 50;  // Across all sessions
const FEEDBACK_META_FILE = 'feedback.meta.json';

/**
 * Load persistent rate limit metadata
 */
function loadFeedbackMeta(projectDir: string): FeedbackRateLimitMeta {
  const metaPath = join(projectDir, SETU_DIR, FEEDBACK_META_FILE);
  
  const today = new Date().toISOString().split('T')[0];
  const defaultMeta: FeedbackRateLimitMeta = {
    dailyCount: 0,
    dailyResetDate: today,
    totalCount: 0
  };
  
  if (!existsSync(metaPath)) {
    return defaultMeta;
  }
  
  try {
    const content = readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Validate expected shape
    if (typeof parsed.dailyCount !== 'number' ||
        typeof parsed.dailyResetDate !== 'string' ||
        typeof parsed.totalCount !== 'number') {
      return defaultMeta;
    }
    
    const meta = parsed as FeedbackRateLimitMeta;
    
    // Reset daily count if it's a new day
    if (meta.dailyResetDate !== today) {
      return {
        ...meta,
        dailyCount: 0,
        dailyResetDate: today
      };
    }
    
    return meta;
  } catch {
    return defaultMeta;
  }
}

/**
 * Save persistent rate limit metadata
 */
function saveFeedbackMeta(projectDir: string, meta: FeedbackRateLimitMeta): void {
  try {
    const setuDir = ensureSetuDir(projectDir);
    const metaPath = join(setuDir, FEEDBACK_META_FILE);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // Silent fail - rate limiting is defense-in-depth
  }
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the feedback submission is allowed */
  allowed: boolean;
  /** Number of submissions remaining this session */
  remaining: number;
  /** Current count (after increment if allowed) */
  current: number;
  /** Reason if not allowed */
  reason?: 'session_limit' | 'daily_limit';
}

/**
 * Check rate limit and increment counter if allowed.
 * 
 * Checks both session-level and daily (persistent) limits.
 * 
 * @param sessionID - The session identifier from ToolContext
 * @param projectDir - Optional project directory for persistent rate limiting
 * @returns Rate limit check result with allowed status and counts
 */
export function incrementFeedbackCount(sessionID: string, projectDir?: string): RateLimitResult {
  // Check session-level limit first
  const sessionCount = sessionFeedbackCounts.get(sessionID) || 0;
  
  if (sessionCount >= MAX_FEEDBACK_PER_SESSION) {
    debugLog(`Feedback session rate limit reached for session ${sessionID} (${sessionCount}/${MAX_FEEDBACK_PER_SESSION})`);
    return { allowed: false, remaining: 0, current: sessionCount, reason: 'session_limit' };
  }
  
  // Load persistent metadata once (if projectDir available)
  let meta: FeedbackRateLimitMeta | null = null;
  if (projectDir) {
    meta = loadFeedbackMeta(projectDir);
    
    // Check persistent daily limit
    if (meta.dailyCount >= DAILY_FEEDBACK_LIMIT) {
      debugLog(`Feedback daily rate limit reached (${meta.dailyCount}/${DAILY_FEEDBACK_LIMIT})`);
      return { allowed: false, remaining: 0, current: sessionCount, reason: 'daily_limit' };
    }
  }
  
  // Increment session counter first
  const newSessionCount = sessionCount + 1;
  sessionFeedbackCounts.set(sessionID, newSessionCount);
  
  // Persist daily counter after session counter is successfully updated
  if (projectDir && meta) {
    meta.dailyCount++;
    meta.totalCount++;
    saveFeedbackMeta(projectDir, meta);
  }
  
  debugLog(`Feedback submitted (session: ${newSessionCount}/${MAX_FEEDBACK_PER_SESSION}) for session ${sessionID}`);
  
  return { 
    allowed: true, 
    remaining: MAX_FEEDBACK_PER_SESSION - newSessionCount,
    current: newSessionCount
  };
}

/**
 * Clear feedback count for a session.
 * Called on session.deleted event to prevent memory leaks.
 * 
 * @param sessionID - The session identifier to clear
 */
export function clearSessionFeedback(sessionID: string): void {
  if (sessionFeedbackCounts.has(sessionID)) {
    sessionFeedbackCounts.delete(sessionID);
    debugLog(`Cleared feedback count for session ${sessionID}`);
  }
}