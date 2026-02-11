import { exec } from 'child_process';

export interface EnvironmentConflict {
  hasConflict: boolean;
  reason?: string;
}

const BUILD_PATTERN = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\bcargo\s+build\b|\bgo\s+build\b/i;

// Character-class trick: [v]ite prevents pgrep from matching its own process
const DEV_PROCESS_QUERY = 'pgrep -f "([v]ite|[n]ext dev|npm run dev|pnpm dev|yarn dev|bun dev)"';

function hasActiveDevServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = exec(DEV_PROCESS_QUERY, { timeout: 1500 }, (error, stdout) => {
      if (error) {
        // pgrep exits non-zero when no match found — not an error
        resolve(false);
        return;
      }
      resolve(stdout.trim().length > 0);
    });
    // Ensure we don't leak child processes
    child.unref?.();
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
