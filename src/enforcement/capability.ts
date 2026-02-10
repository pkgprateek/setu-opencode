import { getStringProp } from '../utils';

export type ToolCapability = 'read_only' | 'mutating' | 'orchestration' | 'unknown';

export interface CapabilityDecision {
  deterministic: ToolCapability;
  advisory: ToolCapability | null;
  final: ToolCapability;
  source: 'deterministic_only' | 'advisory_escalation';
}

const CORE_MUTATING_TOOLS = new Set(['write', 'edit', 'bash', 'apply_patch', 'todowrite', 'setu_task']);
const CORE_ORCHESTRATION_TOOLS = new Set([
  'setu_research',
  'setu_plan',
  'setu_verify',
  'setu_context',
  'setu_reset',
  'setu_feedback',
  'setu_doctor',
  'task',
]);
const CORE_READ_ONLY_TOOLS = new Set(['read', 'glob', 'grep']);

const MUTATING_ARG_KEYS = new Set(['content', 'newString', 'patchText', 'todos', 'command']);
const READ_ONLY_NAME_HINT = /(read|search|query|fetch|get|scrape|map|crawl|status|wiki|doc)/i;

function hasMutatingShape(tool: string, args: Record<string, unknown>): boolean {
  if (CORE_MUTATING_TOOLS.has(tool)) {
    return true;
  }

  const keys = Object.keys(args);
  if (keys.some((key) => MUTATING_ARG_KEYS.has(key))) {
    return true;
  }

  const action = getStringProp(args, 'action')?.toLowerCase();
  if (action && ['create', 'update', 'delete', 'clear'].includes(action)) {
    return true;
  }

  return false;
}

function hasReadOnlyShape(tool: string, args: Record<string, unknown>): boolean {
  if (CORE_READ_ONLY_TOOLS.has(tool)) {
    return true;
  }

  if (!READ_ONLY_NAME_HINT.test(tool)) {
    return false;
  }

  if (hasMutatingShape(tool, args)) {
    return false;
  }

  const keys = Object.keys(args);
  if (keys.length === 0) {
    return true;
  }

  const allowedKeys = new Set([
    'query',
    'url',
    'urls',
    'pattern',
    'path',
    'include',
    'filter',
    'limit',
    'offset',
    'filePath',
    'file_path',
    'dir_path',
    'repo_name',
    'repoName',
    'libraryName',
    'libraryId',
    'thinking',
    'format',
    'formats',
    'sources',
    'prompt',
    'schema',
  ]);

  return keys.every((key) => allowedKeys.has(key));
}

function deterministicCapability(tool: string, args: Record<string, unknown>): ToolCapability {
  if (CORE_ORCHESTRATION_TOOLS.has(tool)) {
    return 'orchestration';
  }

  if (hasMutatingShape(tool, args)) {
    return 'mutating';
  }

  if (hasReadOnlyShape(tool, args)) {
    return 'read_only';
  }

  return 'unknown';
}

/**
 * Advisory layer (model-assisted in future).
 *
 * Current rollout mode is async-learning only, so advisory never downgrades risk.
 * It can only escalate suspicious cases to unknown.
 */
function advisoryCapability(tool: string, args: Record<string, unknown>, deterministic: ToolCapability): ToolCapability | null {
  if (deterministic === 'unknown') return null;

  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';
    if (!command.trim()) {
      return 'unknown';
    }
  }

  if ((tool === 'write' || tool === 'edit') && !(getStringProp(args, 'filePath') ?? '').trim()) {
    return 'unknown';
  }

  return null;
}

export function classifyToolCapability(tool: string, args: Record<string, unknown>): CapabilityDecision {
  const deterministic = deterministicCapability(tool, args);
  const advisory = advisoryCapability(tool, args, deterministic);

  if (advisory === 'unknown' && deterministic !== 'unknown') {
    return {
      deterministic,
      advisory,
      final: 'unknown',
      source: 'advisory_escalation',
    };
  }

  return {
    deterministic,
    advisory,
    final: deterministic,
    source: 'deterministic_only',
  };
}
