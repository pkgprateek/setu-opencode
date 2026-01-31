/**
 * Debug utilities for Setu
 * 
 * Controls verbose logging based on configuration.
 * 
 * Configuration:
 * 1. SETU_DEBUG env var (true/false)
 * 2. Future: setu.json config file (v1.1)
 * 
 * When debug is enabled:
 * - Logs to console with [Setu] prefix
 * - Writes to .setu/debug.log file
 * 
 * Usage:
 *   SETU_DEBUG=true opencode   # Enable debug mode
 *   opencode                    # Production mode (debug off)
 * 
 * Security:
 * - debugLog and errorLog output is redacted to prevent leaking secrets
 * - alwaysLog intentionally bypasses redaction (use only for non-sensitive messages)
 * - See src/security/redaction.ts for redaction patterns
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { redactSensitive } from './security/redaction';

const SETU_DIR = '.setu';
const DEBUG_LOG = 'debug.log';

// Cache the project directory to avoid repeated lookups
let cachedProjectDir: string | null = null;

/**
 * Get the project directory (cached)
 */
function getProjectDir(): string {
  if (cachedProjectDir) return cachedProjectDir;
  cachedProjectDir = process.cwd();
  return cachedProjectDir;
}

/**
 * Set the project directory (called from plugin init)
 */
export function setProjectDir(dir: string): void {
  cachedProjectDir = dir;
}

/**
 * Check if debug mode is enabled
 * 
 * Debug mode is enabled when:
 * - SETU_DEBUG=true or SETU_DEBUG=1 (env var)
 * - Future: setu.json has debug: true (v1.1)
 */
export function isDebugMode(): boolean {
  // Check env var (only method for now)
  const setuDebug = process.env.SETU_DEBUG;
  if (setuDebug === 'true' || setuDebug === '1') {
    return true;
  }
  
  // Default: debug off
  return false;
}

/**
 * Ensure .setu directory exists
 */
function ensureSetuDir(): string {
  const setuDir = join(getProjectDir(), SETU_DIR);
  if (!existsSync(setuDir)) {
    mkdirSync(setuDir, { recursive: true });
  }
  return setuDir;
}

/**
 * Write a log line to the debug file
 * 
 * Note: Assumes args are already redacted by debugLog
 */
function writeToLogFile(message: string, args: unknown[]): void {
  try {
    const setuDir = ensureSetuDir();
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 
      ? ' ' + args.map(a => {
          try {
            return typeof a === 'string' ? a : JSON.stringify(a);
          } catch {
            // Fallback for non-serializable objects
            return String(a);
          }
        }).join(' ')
      : '';
    const logLine = `[${timestamp}] ${message}${argsStr}\n`;
    appendFileSync(join(setuDir, DEBUG_LOG), logLine);
  } catch {
    // Silent fail if can't write to file
  }
}

/**
 * Debug logger - only logs when debug mode is enabled
 * 
 * Logs to both console and .setu/debug.log file.
 * All output is redacted to prevent leaking secrets.
 * 
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (!isDebugMode()) return;
  
  // Redact sensitive data from message
  const redactedMessage = redactSensitive(message);
  
  // Redact sensitive data from args
  const redactedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      return redactSensitive(arg);
    }
    try {
      return redactSensitive(JSON.stringify(arg));
    } catch {
      // Fallback for non-serializable objects - must also be redacted
      return redactSensitive(String(arg));
    }
  });
  
  // Write to console
  console.log(`[Setu] ${redactedMessage}`, ...redactedArgs);
  
  // Write to file
  writeToLogFile(redactedMessage, redactedArgs);
}

/**
 * Always log - for critical messages that should always appear
 * Use sparingly - only for errors or truly important info
 * 
 * Note: Does NOT write to debug.log (only console)
 * 
 * @param message - The message to log
 * @param args - Additional arguments to log
 */
export function alwaysLog(message: string, ...args: unknown[]): void {
  console.log(`[Setu] ${message}`, ...args);
}

/**
 * Error logger - always logs errors with redaction
 * 
 * Writes to both console and debug.log (if debug enabled).
 * SECURITY: Redacts sensitive data from error messages and objects.
 * 
 * @param message - The error message
 * @param error - The error object
 */
export function errorLog(message: string, error?: unknown): void {
  const redactedMessage = redactSensitive(message);
  const redactedError = error ? redactSensitive(String(error)) : '';
  
  console.error(`[Setu] ${redactedMessage}`, redactedError);
  
  // Also write to log file if debug is enabled
  if (isDebugMode()) {
    writeToLogFile(`ERROR: ${redactedMessage}`, redactedError ? [redactedError] : []);
  }
}
