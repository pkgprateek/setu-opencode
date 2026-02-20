/**
 * Security audit logging
 * 
 * Records security-relevant events to .setu/security.log
 * for forensics and debugging.
 */

import { appendFileSync } from 'fs';
import { join } from 'path';
import { ensureSetuDir } from '../context/storage';
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
  HYDRATION_BLOCKED = 'HYDRATION_BLOCKED',
  GIT_DISCIPLINE_BLOCKED = 'GIT_DISCIPLINE_BLOCKED',
  DEPENDENCY_EDIT_BLOCKED = 'DEPENDENCY_EDIT_BLOCKED',
  GEAR_BLOCKED = 'GEAR_BLOCKED',
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',
  HYDRATION_FALLBACK_ALLOWED = 'HYDRATION_FALLBACK_ALLOWED',

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
  [SecurityEventType.HYDRATION_BLOCKED]: 'low',
  [SecurityEventType.GIT_DISCIPLINE_BLOCKED]: 'medium',
  [SecurityEventType.DEPENDENCY_EDIT_BLOCKED]: 'medium',
  [SecurityEventType.GEAR_BLOCKED]: 'medium',
  [SecurityEventType.SAFETY_BLOCKED]: 'high',
  [SecurityEventType.HYDRATION_FALLBACK_ALLOWED]: 'info',
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
 * Strips null bytes and C0/C1 control characters, normalizes newlines (CRLF/CR/LF) 
 * to single spaces, and collapses repeated whitespace.
 * This prevents attackers from injecting fake log entries via newline or control characters.
 * 
 * @param details - Raw event details
 * @returns Sanitized details safe for logging
 */
function sanitizeLogDetails(details: string): string {
  // SECURITY: Strip control characters but preserve CR/LF for newline normalization
  // C0 controls (0x00-0x1F): exclude CR (0x0D) and LF (0x0A) so they can be normalized
  // C1 controls (0x7F-0x9F): strip all
  // This prevents log injection while ensuring proper newline handling
  return details
    .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Replace all CRLF, CR, and LF with a single space
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
    
    // Write header atomically on first create; 'wx' fails with EEXIST if another
    // process already created the file — that race is safe to ignore.
    const header = `# Setu Security Log\n# This file records security-relevant events for forensics\n# Format: [timestamp] SEVERITY | EVENT_TYPE | session:id | tool:name | details\n${'='.repeat(80)}\n\n`;
    try {
      appendFileSync(logPath, header, { flag: 'wx' });
    } catch (err: unknown) {
      if (!(err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST')) {
        throw err;
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
