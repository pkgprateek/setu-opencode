#!/usr/bin/env node

import { bootstrapSetu, type InitScope } from './install/bootstrap';

function printUsage(): void {
  process.stdout.write(
    [
      'Setu CLI',
      '',
      'Usage:',
      '  setu init [--global]',
      '  setu-opencode init [--global]',
      '',
      'Notes:',
      '  - `init` configures OpenCode plugin + agent files.',
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

  if (command !== 'init') {
    process.stderr.write(`Unknown command: ${command}\n\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const scope: InitScope = args.includes('--global') || args.includes('-g') ? 'global' : 'project';
  const result = await bootstrapSetu(scope);

  if (result.warning) {
    process.stderr.write(`[setu] Warning: ${result.warning}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    [
      `[setu] Initialized (${result.scope})`,
      `- Config: ${result.configPath} ${result.pluginAdded ? '(updated)' : '(already configured)'}`,
      `- Agent:  ${result.agentPath} ${result.agentUpdated ? '(created/updated)' : '(already current)'}`
    ].join('\n') + '\n'
  );
}

void run();
