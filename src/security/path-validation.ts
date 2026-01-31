/**
 * Path validation for security
 * 
 * Prevents path traversal attacks and access to sensitive files.
 */

import { resolve, basename, relative, isAbsolute, sep } from 'path';

/**
 * Patterns for files that should not be accessed/modified by the agent
 */
export const SENSITIVE_FILE_PATTERNS = [
  // Secrets and credentials
  /^\.env$/,
  /^\.env\.(local|development|production|test|staging)$/,
  /^\.env\..+$/,  // All .env.* files
  /^credentials\.json$/,
  /^secrets\.json$/,
  /^\.secrets$/,
  
  // SSH keys
  /^id_rsa$/,
  /^id_ed25519$/,
  /^id_ecdsa$/,
  /^id_dsa$/,
  /\.pem$/,
  /\.key$/,
  
  // AWS
  /^\.aws\/credentials$/,
  /^\.aws\/config$/,
  
  // Git credentials
  /^\.git-credentials$/,
  /^\.netrc$/,
  
  // Other auth files
  /^\.npmrc$/,
  /^\.pypirc$/,
  /^kubeconfig$/,
  /^\.kube\/config$/,
] as const;

/**
 * Result of path validation
 */
export interface PathValidationResult {
  valid: boolean;
  error?: string;
  reason?: 'traversal' | 'sensitive' | 'absolute' | 'outside_project';
}

/**
 * Check if a path is within the project directory
 * 
 * @param projectDir - The project root directory
 * @param filePath - The path to validate
 * @returns true if the path is within the project
 */
export function isPathWithinProject(projectDir: string, filePath: string): boolean {
  const resolvedProject = resolve(projectDir);
  const resolvedPath = resolve(projectDir, filePath);
  
  // Path must start with project directory (cross-platform)
  return resolvedPath.startsWith(resolvedProject + sep) || resolvedPath === resolvedProject;
}

/**
 * Check if a filename matches sensitive file patterns
 * 
 * @param filePath - The file path to check
 * @returns true if the file is considered sensitive
 */
export function isSensitiveFile(filePath: string): boolean {
  const name = basename(filePath);
  // Normalize path separators for cross-platform pattern matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  return SENSITIVE_FILE_PATTERNS.some(pattern => 
    pattern.test(name) || pattern.test(normalizedPath)
  );
}

/**
 * Validate a file path for security
 * 
 * Checks:
 * 1. Path traversal (../ sequences that escape project)
 * 2. Absolute paths outside project
 * 3. Sensitive file patterns
 * 
 * @param projectDir - The project root directory
 * @param filePath - The path to validate
 * @param options - Validation options
 * @returns Validation result with error details if invalid
 */
export function validateFilePath(
  projectDir: string,
  filePath: string,
  options: {
    allowSensitive?: boolean;  // For read operations where we want to warn, not block
    allowAbsoluteWithinProject?: boolean;  // Allow absolute paths if within project
  } = {}
): PathValidationResult {
  const { allowSensitive = false, allowAbsoluteWithinProject = true } = options;
  
  // Handle absolute paths
  if (isAbsolute(filePath)) {
    const resolved = resolve(filePath);
    const projectRoot = resolve(projectDir);
    
    if (!resolved.startsWith(projectRoot + sep) && resolved !== projectRoot) {
      return {
        valid: false,
        error: `Path '${filePath}' is outside the project directory`,
        reason: 'outside_project'
      };
    }
    
    if (!allowAbsoluteWithinProject) {
      return {
        valid: false,
        error: `Absolute paths not allowed: ${filePath}`,
        reason: 'absolute'
      };
    }
  }
  
  // Check for path traversal
  const resolved = resolve(projectDir, filePath);
  const projectRoot = resolve(projectDir);
  const relativePath = relative(projectRoot, resolved);
  
  // If relative path starts with '..' after resolution, it's traversal
  if (relativePath.startsWith('..')) {
    return {
      valid: false,
      error: `Path traversal attempt blocked: ${filePath}`,
      reason: 'traversal'
    };
  }
  
  // Check sensitive files
  if (!allowSensitive && isSensitiveFile(filePath)) {
    return {
      valid: false,
      error: `Access to sensitive file blocked: ${basename(filePath)}`,
      reason: 'sensitive'
    };
  }
  
  return { valid: true };
}
