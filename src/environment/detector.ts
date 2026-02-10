import { execSync } from 'child_process';

export interface EnvironmentConflict {
  hasConflict: boolean;
  reason?: string;
}

const BUILD_PATTERN = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\bcargo\s+build\b|\bgo\s+build\b/i;
const DEV_PROCESS_QUERY = 'pgrep -f "(vite|next dev|npm run dev|pnpm dev|yarn dev|bun dev)"';

function hasActiveDevServer(): boolean {
  try {
    const output = execSync(DEV_PROCESS_QUERY, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
      timeout: 1500,
    }).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

export function detectEnvironmentConflict(command: string): EnvironmentConflict {
  if (!BUILD_PATTERN.test(command)) {
    return { hasConflict: false };
  }

  if (!hasActiveDevServer()) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    reason: 'Build command detected while a dev server appears active.',
  };
}
