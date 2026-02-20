import { bootstrapSetuGlobal, isExplicitGlobalInstallEnv } from './install/bootstrap';

const README_URL = 'https://github.com/pkgprateek/setu-opencode#installation';

async function runPostinstall(): Promise<void> {
  if (!isExplicitGlobalInstallEnv()) {
    process.stdout.write('[setu] Non-global install detected. Skipping global OpenCode bootstrap.\n');
    process.stdout.write('[setu] A simpler project-level installation flow is coming soon.\n');
    process.stdout.write(`[setu] For project-only setup options today, see: ${README_URL}\n`);
    return;
  }

  const result = await bootstrapSetuGlobal();

  if (result.warning) {
    process.stderr.write(`[setu] Global bootstrap skipped: ${result.warning}\n`);
    process.stderr.write('[setu] Run `setu init` manually after fixing the config.\n');
    return;
  }

  process.stdout.write('[setu] Global OpenCode bootstrap complete.\n');
}

void runPostinstall();
