import { bootstrapSetu, isLikelyGlobalInstallEnv } from './install/bootstrap';

async function runPostinstall(): Promise<void> {
  if (!isLikelyGlobalInstallEnv()) {
    return;
  }

  const result = await bootstrapSetu('global');

  if (result.warning) {
    process.stderr.write(`[setu] Global bootstrap skipped: ${result.warning}\n`);
    process.stderr.write('[setu] Run `setu init --global` manually after fixing the config.\n');
    return;
  }

  process.stdout.write('[setu] Global OpenCode bootstrap complete.\n');
}

void runPostinstall();
