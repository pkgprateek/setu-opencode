import { getStringProp } from '../utils';

export type HardSafetyAction = 'ask' | 'block';

export interface SafetyDecision {
  hardSafety: boolean;
  action: HardSafetyAction;
  reasons: string[];
}

const DESTRUCTIVE_BASH_PATTERNS: RegExp[] = [
  // Covers: rm with -r/-f/--recursive/--force anywhere on the line, even with intervening flags
  /\brm\b(?=.*(?:-\w*[rf]|--recursive|--force))/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b[^\n]*\s-(?:[^\n]*f|[^\n]*d|[^\n]*x)/i,
  /\bmkfs\b/i,
  /\bdd\b\s+if=/i,
  // Pipe-to-shell: curl/wget eventually piped to sh/bash/zsh/dash (remote code execution)
  // Handles multi-stage pipelines: curl url | cat | sudo sh -c "..."
  /\b(?:curl|wget)\b[^\n]*\|[^\n]*\b(?:sudo\s+)?(?:ba|z|da)?sh\b/i,
];

const FILE_MUTATION_BASH_PATTERNS: RegExp[] = [
  /\btouch\b\s+[^\n]+/i,
  /(^|\s)(?:>|>>)\s*[^\s]+/i,
  /\btruncate\b\s+[^\n]+/i,
];

const PRODUCTION_BASH_PATTERNS: RegExp[] = [
  /\bnpm\s+publish\b/i,
  /\bpnpm\s+publish\b/i,
  /\byarn\s+publish\b/i,
  /\bkubectl\s+apply\b/i,
  /\bterraform\s+apply\b/i,
  /\bdocker\s+push\b/i,
  /\bgit\s+push\b/i,
];

const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/).*\.(pem|key|p12|pfx)$/i,
  /(^|\/)(id_rsa|id_ed25519)$/i,
  /(^|\/)(credentials|secrets?)\.(json|ya?ml|env)$/i,
];

export function classifyHardSafety(tool: string, args: Record<string, unknown>): SafetyDecision {
  const reasons: string[] = [];

  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';

    for (const pattern of DESTRUCTIVE_BASH_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push('Destructive shell command detected');
        break;
      }
    }

    for (const pattern of PRODUCTION_BASH_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push('Production-impacting command detected');
        break;
      }
    }

    for (const pattern of FILE_MUTATION_BASH_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push('Filesystem mutation via shell detected');
        break;
      }
    }
  }

  if (tool === 'write' || tool === 'edit') {
    const filePath = getStringProp(args, 'filePath') ?? '';
    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        reasons.push('Sensitive file path detected');
        break;
      }
    }
  }

  if (reasons.length === 0) {
    return { hardSafety: false, action: 'ask', reasons: [] };
  }

  const action: HardSafetyAction = reasons.some((r) => r.includes('Destructive')) ? 'block' : 'ask';
  return { hardSafety: true, action, reasons };
}
