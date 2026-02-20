#!/usr/bin/env node

import { bootstrapSetuGlobal, uninstallSetuGlobal } from './install/bootstrap';

function printUsage(): void {
  process.stdout.write(
    [
      'Setu CLI',
      '',
      'Usage:',
      '  setu init',
      '  setu uninstall',
      '  setu-opencode init',
      '  setu-opencode uninstall',
      '',
      'Notes:',
      '  - `init` configures global OpenCode plugin + agent files.',
      '  - `uninstall` removes global Setu plugin + agent wiring.',
      '  - `.setu/` is created dynamically at runtime by Setu tools.'
    ].join('\n') + '\n'
  );
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (command !== 'init' && command !== 'uninstall') {
    process.stderr.write(`Unknown command: ${command}\n\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === 'init') {
    const result = await bootstrapSetuGlobal();

    if (result.warning) {
      process.stderr.write(`[setu] Warning: ${result.warning}\n`);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(
      [
        '[setu] Initialized (global)',
        `- Config: ${result.configPath} ${result.pluginAdded ? '(updated)' : '(already configured)'}`,
        `- Agent:  ${result.agentPath} ${result.agentUpdated ? '(created/updated)' : '(already current)'}`
      ].join('\n') + '\n'
    );
    return;
  }

  const result = uninstallSetuGlobal();
  if (result.warning) {
    process.stderr.write(`[setu] Warning: ${result.warning}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    [
      '[setu] Uninstalled (global)',
      `- Config: ${result.configPath} ${result.pluginRemoved ? '(plugin removed)' : '(plugin already absent)'}`,
      `- Agent:  ${result.agentPath} ${result.agentRemoved ? '(removed)' : '(already absent)'}`
    ].join('\n') + '\n'
  );
}

void run();
