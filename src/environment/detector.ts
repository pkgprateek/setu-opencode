import { exec, type ExecException } from 'child_process';
import { debugLog } from '../debug';

export interface EnvironmentConflict {
  hasConflict: boolean;
  reason?: string;
}

const BUILD_PATTERN = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\bcargo\s+build\b|\bgo\s+build\b/i;

// Character-class trick: [v]ite prevents pgrep from matching its own process
const DEV_PROCESS_QUERY = 'pgrep -f "([v]ite|[n]ext dev|npm run dev|pnpm dev|yarn dev|bun dev)"';

function hasActiveDevServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = exec(DEV_PROCESS_QUERY, { timeout: 1500 }, (error: ExecException | null, stdout) => {
      if (error) {
        // pgrep exit code 1 = no match found — safe, no dev server
        if (error.code === 1) {
          resolve(false);
          return;
        }
        // Timeout, exec failure, or unexpected exit code — fail-closed
        // Assume dev server may exist to prevent unsafe builds
        debugLog('Dev server check failed (fail-closed):', error.message);
        resolve(true);
        return;
      }
      resolve(stdout.trim().length > 0);
    });
    child.unref();
  });
}

export async function detectEnvironmentConflict(command: string): Promise<EnvironmentConflict> {
  if (!BUILD_PATTERN.test(command)) {
    return { hasConflict: false };
  }

  if (!(await hasActiveDevServer())) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    reason: 'Build command detected while a dev server appears active.',
  };
}
