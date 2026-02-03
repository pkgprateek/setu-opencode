/**
 * Security audit logging
 * 
 * Records security-relevant events to .setu/security.log
 * for forensics and debugging.
 */

import { existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { ensureSetuDir } from '../context/feedback';
import { debugLog } from '../debug';

const SECURITY_LOG = 'security.log';
const MAX_LOG_ENTRY_LENGTH = 1000;

/**
 * Types of security events
 */
export enum SecurityEventType {
  // Blocking events
  PATH_TRAVERSAL_BLOCKED = 'PATH_TRAVERSAL_BLOCKED',
  SENSITIVE_FILE_BLOCKED = 'SENSITIVE_FILE_BLOCKED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  PHASE0_BLOCKED = 'PHASE0_BLOCKED',
  GIT_DISCIPLINE_BLOCKED = 'GIT_DISCIPLINE_BLOCKED',
  DEPENDENCY_EDIT_BLOCKED = 'DEPENDENCY_EDIT_BLOCKED',
  GEAR_BLOCKED = 'GEAR_BLOCKED',
  
  // Warning events
  BYPASS_ATTEMPT_DETECTED = 'BYPASS_ATTEMPT_DETECTED',
  SECRETS_DETECTED = 'SECRETS_DETECTED',
  PROMPT_INJECTION_SANITIZED = 'PROMPT_INJECTION_SANITIZED',
  
  // Info events
  RATE_LIMIT_TRIGGERED = 'RATE_LIMIT_TRIGGERED',
  CONSTRAINT_ENFORCED = 'CONSTRAINT_ENFORCED'
}

/**
 * Security event structure
 */
export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  sessionId?: string;
  tool?: string;
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

/**
 * Severity mapping for event types
 */
const EVENT_SEVERITY: Record<SecurityEventType, SecurityEvent['severity']> = {
  [SecurityEventType.PATH_TRAVERSAL_BLOCKED]: 'high',
  [SecurityEventType.SENSITIVE_FILE_BLOCKED]: 'medium',
  [SecurityEventType.CONSTRAINT_VIOLATION]: 'medium',
  [SecurityEventType.PHASE0_BLOCKED]: 'low',
  [SecurityEventType.GIT_DISCIPLINE_BLOCKED]: 'medium',
  [SecurityEventType.DEPENDENCY_EDIT_BLOCKED]: 'medium',
  [SecurityEventType.GEAR_BLOCKED]: 'medium',
  [SecurityEventType.BYPASS_ATTEMPT_DETECTED]: 'high',
  [SecurityEventType.SECRETS_DETECTED]: 'critical',
  [SecurityEventType.PROMPT_INJECTION_SANITIZED]: 'medium',
  [SecurityEventType.RATE_LIMIT_TRIGGERED]: 'low',
  [SecurityEventType.CONSTRAINT_ENFORCED]: 'info'
};

/**
 * Format a security event for logging
 */
function formatSecurityEvent(event: SecurityEvent): string {
  const severityPrefix = {
    critical: '🚨 CRITICAL',
    high: '⚠️  HIGH',
    medium: '⚡ MEDIUM',
    low: '📋 LOW',
    info: 'ℹ️  INFO'
  }[event.severity];
  
  let entry = `[${event.timestamp}] ${severityPrefix} | ${event.type}`;
  
  if (event.sessionId) {
    entry += ` | session:${event.sessionId.slice(0, 8)}...`;
  }
  
  if (event.tool) {
    entry += ` | tool:${event.tool}`;
  }
  
  // Details are already sanitized in logSecurityEvent
  // Truncate to prevent log bloat
  const TRUNCATION_SUFFIX = '...(truncated)';
  const details = event.details.length > MAX_LOG_ENTRY_LENGTH
    ? event.details.slice(0, Math.max(0, MAX_LOG_ENTRY_LENGTH - TRUNCATION_SUFFIX.length)) + TRUNCATION_SUFFIX
    : event.details;
  
  entry += ` | ${details}`;
  
  return entry;
}

/**
 * Sanitize event details to prevent log injection
 * 
 * Normalizes newlines (CRLF/CR/LF) to single spaces and collapses repeated whitespace.
 * This prevents attackers from injecting fake log entries via newline characters.
 * 
 * @param details - Raw event details
 * @returns Sanitized details safe for logging
 */
function sanitizeLogDetails(details: string): string {
  // Replace all CRLF, CR, and LF with a single space
  return details
    .replace(/\r\n|\r|\n/g, ' ')
    // Collapse multiple spaces into one
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Log a security event
 * 
 * Writes to .setu/security.log for forensics.
 * Also returns the formatted event for optional console logging.
 * 
 * @param projectDir - Project root directory
 * @param type - Type of security event
 * @param details - Event details
 * @param options - Additional options (sessionId, tool)
 * @returns The formatted event string
 */
export function logSecurityEvent(
  projectDir: string,
  type: SecurityEventType,
  details: string,
  options: {
    sessionId?: string;
    tool?: string;
  } = {}
): string {
  // SECURITY: Sanitize newlines BEFORE creating event to prevent log injection
  const sanitizedDetails = sanitizeLogDetails(details);
  
  const event: SecurityEvent = {
    type,
    timestamp: new Date().toISOString(),
    sessionId: options.sessionId,
    tool: options.tool,
    details: sanitizedDetails,
    severity: EVENT_SEVERITY[type]
  };
  
  const formatted = formatSecurityEvent(event);
  
  try {
    const setuDir = ensureSetuDir(projectDir);
    const logPath = join(setuDir, SECURITY_LOG);
    
    // Add header if file doesn't exist
    // Use atomic operation to prevent TOCTOU race
    if (!existsSync(logPath)) {
      const header = `# Setu Security Log\n# This file records security-relevant events for forensics\n# Format: [timestamp] SEVERITY | EVENT_TYPE | session:id | tool:name | details\n${'='.repeat(80)}\n\n`;
      try {
        // Atomic write with exclusive flag - fails if file exists
        appendFileSync(logPath, header, { flag: 'wx' });
      } catch (err: unknown) {
        // File was created by another process - that's fine, skip header
        if (err && typeof err === 'object' && 'code' in err && err.code !== 'EEXIST') {
          throw err; // Re-throw non-EEXIST errors
        }
      }
    }
    
    appendFileSync(logPath, formatted + '\n', 'utf-8');
  } catch (err) {
    // Silent fail - security logging should not break functionality
    // Log to debug for operational visibility during development
    debugLog('Security audit log write failed:', err);
  }
  
  return formatted;
}
