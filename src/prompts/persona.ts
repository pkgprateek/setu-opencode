// ============================================================================
// File Availability
// ============================================================================

export interface FileAvailability {
  active: boolean;
  context: boolean;
  agentsMd: boolean;
  claudeMd: boolean;
}

export const getModePrefix = (isDefault: boolean = false): string => {
  const suffix = isDefault ? ' (Default)' : '';
  return `[Setu${suffix}]`;
};

const getModeGuidance = (): string => {
  return 'Disciplined execution with safety and verification.';
};

export const getFileAvailability = (files: FileAvailability): string => {
  const available: string[] = [];

  if (files.agentsMd) available.push('AGENTS.md');
  if (files.claudeMd) available.push('CLAUDE.md');
  if (files.context) available.push('.setu/context.json');
  if (files.active) available.push('.setu/active.json');

  if (available.length === 0) {
    return '[Context: Fresh start - no project rules or previous context]';
  }

  const hasRules = files.agentsMd || files.claudeMd;
  const hasContext = files.context || files.active;

  let guidance = '';
  if (hasRules && hasContext) {
    guidance = 'Project rules and previous context available.';
  } else if (hasRules) {
    guidance = 'Project rules available.';
  } else if (hasContext) {
    guidance = 'Previous context available.';
  }

  return `[Context: ${available.join(', ')}]\n[${guidance}]`;
};

export const getStateInjection = (
  files: FileAvailability,
  isDefault: boolean = false
): string => {
  const modePrefix = getModePrefix(isDefault);
  const fileInfo = getFileAvailability(files);
  const guidance = getModeGuidance();

  return `${modePrefix}\n${fileInfo}\n${guidance}`;
};
