/**
 * Environment Doctor Tool
 * 
 * Prevents "Ghost Loops" where agent tries to fix code when environment is broken.
 * Checks environment health before execution:
 * - Git status (uncommitted changes, detached HEAD)
 * - Dependencies (node_modules, lockfile sync)
 * - Runtime issues (missing binaries, wrong versions)
 */

import { tool } from '@opencode-ai/plugin';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../debug';
import { getErrorMessage } from '../utils/error-handling';

const execAsync = promisify(exec);

/**
 * Health check result for a single check
 */
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  fix?: string;  // Suggested fix command or action
}

/**
 * Overall doctor result
 */
export interface DoctorResult {
  status: 'healthy' | 'issues';
  checks: HealthCheck[];
  recommendation: string;
}

/**
 * Execute a shell command with timeout
 */
async function execCommand(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execAsync(command, { cwd, timeout: 5000 });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number | string };
    const exitCode = typeof execError.code === 'number' ? execError.code : 1;
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode
    };
  }
}

/**
 * Check git repository status
 */
async function checkGitStatus(projectDir: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  try {
    // Check if it's a git repository
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gitDir)) {
      checks.push({
        name: 'git-repo',
        status: 'warning',
        message: 'Not a git repository',
        fix: 'git init'
      });
      return checks;
    }
    
    // Check for uncommitted changes
    const statusResult = await execCommand('git status --porcelain', projectDir);
    if (statusResult.exitCode !== 0) {
      // git status failed
      checks.push({
        name: 'git-status',
        status: 'error',
        message: `git status failed: ${statusResult.stderr || 'unknown error'}`,
        fix: 'Check git repository integrity'
      });
    } else if (statusResult.stdout.trim()) {
      const fileCount = statusResult.stdout.trim().split('\n').length;
      checks.push({
        name: 'git-status',
        status: 'warning',
        message: `Working tree has ${fileCount} uncommitted change(s)`,
        fix: 'git add . && git commit -m "WIP"'
      });
    } else {
      checks.push({
        name: 'git-status',
        status: 'healthy',
        message: 'Working tree clean'
      });
    }
    
    // Check for detached HEAD
    const headResult = await execCommand('git symbolic-ref --short HEAD', projectDir);
    if (headResult.exitCode !== 0) {
      checks.push({
        name: 'git-head',
        status: 'warning',
        message: 'HEAD is detached',
        fix: 'git checkout main'
      });
    } else {
      checks.push({
        name: 'git-head',
        status: 'healthy',
        message: `On branch ${headResult.stdout.trim()}`
      });
    }
    
  } catch (error) {
    checks.push({
      name: 'git-check',
      status: 'error',
      message: `Failed to check git status: ${getErrorMessage(error)}`
    });
  }
  
  return checks;
}

/**
 * Check Node.js dependencies
 */
async function checkDependencies(projectDir: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  const hasPackageJson = existsSync(join(projectDir, 'package.json'));
  const hasNodeModules = existsSync(join(projectDir, 'node_modules'));
  
  if (!hasPackageJson) {
    // Not a Node.js project - skip dependency checks
    return checks;
  }
  
  // Check for missing node_modules
  if (!hasNodeModules) {
    checks.push({
      name: 'deps-installed',
      status: 'error',
      message: 'node_modules missing',
      fix: 'npm install'
    });
    return checks;  // Skip further checks if deps not installed
  }
  
  // Check lockfile sync (compare modification times)
  const lockfiles = [
    { file: 'package-lock.json', installer: 'npm install' },
    { file: 'yarn.lock', installer: 'yarn install' },
    { file: 'pnpm-lock.yaml', installer: 'pnpm install' },
    { file: 'bun.lockb', installer: 'bun install' }
  ];
  
  for (const { file, installer } of lockfiles) {
    const lockPath = join(projectDir, file);
    if (existsSync(lockPath)) {
      try {
        const lockStat = statSync(lockPath);
        const nodeModulesStat = statSync(join(projectDir, 'node_modules'));
        
        // If lockfile is newer than node_modules, deps may be out of sync
        if (lockStat.mtime > nodeModulesStat.mtime) {
          checks.push({
            name: 'deps-sync',
            status: 'warning',
            message: `${file} is newer than node_modules - dependencies may be out of sync`,
            fix: installer
          });
        } else {
          checks.push({
            name: 'deps-sync',
            status: 'healthy',
            message: 'Dependencies appear to be in sync'
          });
        }
      } catch (error) {
        // Stat errors are non-critical but useful for debugging
        debugLog('Failed to stat lockfile or node_modules:', error);
      }
      break;  // Only check first found lockfile
    }
  }
  
  return checks;
}

/**
 * Check project rules (AGENTS.md, CLAUDE.md)
 */
function checkProjectRules(projectDir: string): HealthCheck[] {
  const checks: HealthCheck[] = [];
  
  const hasAgentsMd = existsSync(join(projectDir, 'AGENTS.md'));
  const hasClaudeMd = existsSync(join(projectDir, 'CLAUDE.md'));
  
  if (hasAgentsMd) {
    checks.push({
      name: 'project-rules',
      status: 'healthy',
      message: 'AGENTS.md found'
    });
  } else if (hasClaudeMd) {
    checks.push({
      name: 'project-rules',
      status: 'healthy',
      message: 'CLAUDE.md found (AGENTS.md compatible)'
    });
  } else {
    checks.push({
      name: 'project-rules',
      status: 'warning',
      message: 'No AGENTS.md or CLAUDE.md found',
      fix: 'Run /init in OpenCode to generate project rules'
    });
  }
  
  return checks;
}

/**
 * Check build/runtime environment
 */
async function checkRuntime(projectDir: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  // Check Node.js version if package.json exists
  const packageJsonPath = join(projectDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const nodeResult = await execCommand('node --version', projectDir);
      if (nodeResult.exitCode === 0) {
        checks.push({
          name: 'node-version',
          status: 'healthy',
          message: `Node.js ${nodeResult.stdout.trim()}`
        });
      } else {
        // Non-zero exit code
        checks.push({
          name: 'node-version',
          status: 'error',
          message: `Node.js check failed: ${nodeResult.stderr || 'unknown error'}`,
          fix: 'Install Node.js from https://nodejs.org'
        });
      }
    } catch (error) {
      debugLog('Failed to check Node.js version:', error);
      checks.push({
        name: 'node-version',
        status: 'error',
        message: 'Node.js not found in PATH',
        fix: 'Install Node.js from https://nodejs.org'
      });
    }
  }
  
  // Check TypeScript if tsconfig.json exists
  if (existsSync(join(projectDir, 'tsconfig.json'))) {
    try {
      const tscResult = await execCommand('npx tsc --version', projectDir);
      if (tscResult.exitCode === 0) {
        checks.push({
          name: 'typescript',
          status: 'healthy',
          message: `TypeScript ${tscResult.stdout.trim().replace('Version ', '')}`
        });
      } else {
        checks.push({
          name: 'typescript',
          status: 'warning',
          message: 'TypeScript not available',
          fix: 'npm install -D typescript'
        });
      }
    } catch (error) {
      debugLog('Failed to check TypeScript version:', error);
      checks.push({
        name: 'typescript',
        status: 'warning',
        message: 'TypeScript check failed',
        fix: 'npm install -D typescript'
      });
    }
  }
  
  return checks;
}

/**
 * Run all health checks and return aggregated result
 */
async function runDoctorChecks(projectDir: string): Promise<DoctorResult> {
  const allChecks: HealthCheck[] = [];
  
  // Run checks in parallel for efficiency
  const [gitChecks, depChecks, runtimeChecks] = await Promise.all([
    checkGitStatus(projectDir),
    checkDependencies(projectDir),
    checkRuntime(projectDir)
  ]);
  
  allChecks.push(...gitChecks, ...depChecks, ...runtimeChecks);
  
  // Add project rules check (synchronous, no need for Promise.all)
  allChecks.push(...checkProjectRules(projectDir));
  
  // Determine overall status
  const hasErrors = allChecks.some(c => c.status === 'error');
  const hasWarnings = allChecks.some(c => c.status === 'warning');
  
  const status = hasErrors || hasWarnings ? 'issues' : 'healthy';
  
  // Generate recommendation
  let recommendation: string;
  if (hasErrors) {
    const errorChecks = allChecks.filter(c => c.status === 'error');
    recommendation = `Fix ${errorChecks.length} error(s) before attempting code changes:\n` +
      errorChecks.map(c => `  - ${c.message}${c.fix ? ` (${c.fix})` : ''}`).join('\n');
  } else if (hasWarnings) {
    recommendation = 'Environment has warnings but is usable. Consider addressing before complex changes.';
  } else {
    recommendation = 'Environment looks healthy. Ready for development.';
  }
  
  debugLog(`Doctor check complete: ${status} (${allChecks.length} checks)`);
  
  return {
    status,
    checks: allChecks,
    recommendation
  };
}

/**
 * Format doctor result for display
 */
function formatDoctorResult(result: DoctorResult): string {
  const lines: string[] = [];
  
  // Status header
  const statusEmoji = result.status === 'healthy' ? '✓' : '⚠';
  lines.push(`${statusEmoji} Environment: ${result.status.toUpperCase()}`);
  lines.push('');
  
  // Group checks by status
  const errors = result.checks.filter(c => c.status === 'error');
  const warnings = result.checks.filter(c => c.status === 'warning');
  const healthy = result.checks.filter(c => c.status === 'healthy');
  
  if (errors.length > 0) {
    lines.push('Errors:');
    for (const check of errors) {
      lines.push(`  ✗ ${check.name}: ${check.message}`);
      if (check.fix) lines.push(`    Fix: ${check.fix}`);
    }
    lines.push('');
  }
  
  if (warnings.length > 0) {
    lines.push('Warnings:');
    for (const check of warnings) {
      lines.push(`  ⚠ ${check.name}: ${check.message}`);
      if (check.fix) lines.push(`    Fix: ${check.fix}`);
    }
    lines.push('');
  }
  
  if (healthy.length > 0) {
    lines.push('Healthy:');
    for (const check of healthy) {
      lines.push(`  ✓ ${check.name}: ${check.message}`);
    }
    lines.push('');
  }
  
  lines.push(`Recommendation: ${result.recommendation}`);
  
  return lines.join('\n');
}

/**
 * Create the setu_doctor tool
 */
export function createSetuDoctorTool(
  getProjectDir: () => string
): ReturnType<typeof tool> {
  return tool({
    description: `Check environment health before execution.
Detects common issues that cause "ghost loops":
- Git: uncommitted changes, detached HEAD
- Dependencies: missing node_modules, outdated lockfile
- Runtime: missing Node.js, TypeScript issues
- Project Rules: validates AGENTS.md and CLAUDE.md (or compatible project policy files)

Run this before starting complex tasks to ensure a clean environment.`,
    
    args: {
      verbose: tool.schema.boolean().optional().describe(
        'Include all checks in output, not just issues'
      )
    },
    
    async execute(args: { verbose?: boolean }, _context?: unknown): Promise<string> {
      const projectDir = getProjectDir();
      const result = await runDoctorChecks(projectDir);

      // If not verbose, filter to only issues
      const checks = args.verbose
        ? result.checks
        : result.checks.filter(c => c.status !== 'healthy');

      return formatDoctorResult({ ...result, checks });
    }
  });
}
