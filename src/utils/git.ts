/**
 * Git Utilities
 * 
 * Helpers for git operations used in pre-commit checklist.
 */

import { execSync } from 'child_process';
import { statSync } from 'fs';
import { resolve } from 'path';
import { debugLog } from '../debug';

/**
 * Protected branch names that warrant extra caution
 */
export const PROTECTED_BRANCHES = ['main', 'master', 'production', 'prod'] as const;

/**
 * Validate a directory path for security
 * 
 * @param dirPath - Path to validate
 * @returns Resolved path if valid, null if invalid
 */
function validateProjectDir(dirPath: string): string | null {
  // Reject null bytes
  if (dirPath.includes('\0')) {
    debugLog('Rejected projectDir: contains null byte');
    return null;
  }
  
  // Reject empty or non-string
  if (!dirPath || typeof dirPath !== 'string') {
    debugLog('Rejected projectDir: empty or non-string');
    return null;
  }
  
  // Resolve to absolute path (normalizes ..)
  const resolved = resolve(dirPath);
  
  // Verify it exists and is a directory
  try {
    const stat = statSync(resolved);
    if (!stat.isDirectory()) {
      debugLog('Rejected projectDir: not a directory');
      return null;
    }
  } catch {
    debugLog('Rejected projectDir: does not exist');
    return null;
  }
  
  return resolved;
}

/**
 * Get the current git branch name
 * 
 * @param projectDir - Project directory to run git command in
 * @returns Branch name or 'unknown' if detection fails
 */
export function getCurrentBranch(projectDir: string): string {
  // Validate projectDir before use
  const validatedDir = validateProjectDir(projectDir);
  if (!validatedDir) {
    return 'unknown';
  }
  
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: validatedDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    return branch || 'unknown';
  } catch (error) {
    debugLog('Failed to get current branch:', error);
    return 'unknown';
  }
}

/**
 * Check if the current branch is a protected branch
 * 
 * @param branch - Branch name to check
 * @returns true if branch is protected
 */
export function isProtectedBranch(branch: string): boolean {
  return PROTECTED_BRANCHES.includes(branch.toLowerCase() as typeof PROTECTED_BRANCHES[number]);
}
