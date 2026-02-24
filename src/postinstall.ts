import { bootstrapSetuGlobal, isExplicitGlobalInstallEnv } from './install/bootstrap';

const README_URL = 'https://github.com/pkgprateek/setu-opencode#installation-30-seconds';

async function runPostinstall(): Promise<void> {
  if (!isExplicitGlobalInstallEnv()) {
    process.stdout.write('[setu] Non-global install detected. Skipping global OpenCode bootstrap.\n');
    process.stdout.write('[setu] Global install is the supported setup for auto-bootstrap.\n');
    process.stdout.write('[setu] Install globally, then run `setu init` if bootstrap was skipped.\n');
    process.stdout.write(`[setu] Setup guide: ${README_URL}\n`);
    return;
  }

  let result: Awaited<ReturnType<typeof bootstrapSetuGlobal>>;
  try {
    result = await bootstrapSetuGlobal();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[setu] Global bootstrap failed unexpectedly: ${message}\n`);
    process.stderr.write('[setu] Installation will continue. Run `setu init` manually if needed.\n');
    return;
  }

  if (result.warning) {
    process.stderr.write(`[setu] Global bootstrap skipped: ${result.warning}\n`);
    process.stderr.write('[setu] Run `setu init` manually after fixing the config.\n');
    return;
  }

  process.stdout.write('[setu] Global OpenCode bootstrap complete.\n');
}

void runPostinstall().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[setu] Postinstall warning: ${message}\n`);
});
