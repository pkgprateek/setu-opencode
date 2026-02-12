import { getStringProp } from '../utils';

export type HardSafetyAction = 'allow' | 'ask' | 'block';

/**
 * Structured category for safety classification.
 * Action determination is derived from this enum, not from reason text.
 * 'destructive' → block (irrecoverable operations like rm -rf, git reset --hard)
 * 'production' | 'mutation' | 'sensitive' → ask (reversible but risky)
 */
export type SafetyCategory = 'destructive' | 'production' | 'mutation' | 'sensitive';

/** Maps category to enforcement action. Single source of truth. */
const CATEGORY_ACTION: Record<SafetyCategory, HardSafetyAction> = {
  destructive: 'block',
  production: 'ask',
  mutation: 'ask',
  sensitive: 'ask',
};

export interface SafetyReason {
  category: SafetyCategory;
  message: string;
}

export interface SafetyDecision {
  hardSafety: boolean;
  action: HardSafetyAction;
  reasons: string[];
}

const DESTRUCTIVE_BASH_PATTERNS: RegExp[] = [
  // Covers: rm with dangerous flags anywhere on line, including escaped/prefixed invocations
  // Bounded to prevent ReDoS on adversarial input
  /(?:^|[\s;|&])(?:\\?rm|command\s+rm)\b[^\n]{0,500}(?:-\w*[rf]|--recursive|--force|--no-preserve-root)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b[^\n]*\s-(?:[^\n]*f|[^\n]*d|[^\n]*x)/i,
  /\bmkfs\b/i,
  /\bdd\b\s+if=/i,
  // Pipe-to-shell: curl/wget piped to shell (RCE vector)
  // Bounded to prevent ReDoS; covers sh/bash/zsh/dash across multi-stage pipelines
  /\b(?:curl|wget)\b[^\n]{0,500}\|[^\n]{0,500}\b(?:sudo\s+)?(?:ba|z|da)?sh\b/i,
  // Process substitution: sh <(curl ...) or bash <(wget ...)
  /\b(?:ba|z|da)?sh\b\s+<\(\s*(?:curl|wget)\b/i,
];

const FILE_MUTATION_BASH_PATTERNS: RegExp[] = [
  /\btouch\b\s+[^\n]+/i,
  /(^|\s)(?:>|>>)\s*[^\s]+/i,
  /\btruncate\b\s+[^\n]+/i,
  /\b(?:sed)\b\s+[-\w\s]{0,200}-i\b/i,
  /\|\s*tee\b/i,
  /\bmv\b\s+[^\n]+/i,
  /\b(?:chmod|chown)\b\s+[^\n]+/i,
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
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)\.pgpass$/i,
  /(^|\/)known_hosts$/i,
  /(^|\/)authorized_keys$/i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)\.docker\/config\.json$/i,
];

/**
 * Shell-aware tokenizer that handles quoted strings and escaped characters.
 * 
 * This is a simplified POSIX-style tokenizer that:
 * - Respects single and double quotes
 * - Handles escaped spaces and quotes
 * - Strips quotes from the final token
 * 
 * Note: Does not handle variable expansion or complex shell constructs.
 * For a security-critical classifier, this provides defense in depth
 * beyond simple whitespace splitting.
 */
function tokenizeShell(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escaped) {
      // Previous char was backslash, include this char literally
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      // Backslash escapes next char, except in single quotes
      escaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      // Toggle single quote mode
      inSingleQuote = !inSingleQuote;
      continue; // Don't include the quote itself
    }

    if (char === '"' && !inSingleQuote) {
      // Toggle double quote mode
      inDoubleQuote = !inDoubleQuote;
      continue; // Don't include the quote itself
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      // Whitespace outside quotes: token boundary
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  // Don't forget the last token
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export function classifyHardSafety(tool: string, args: Record<string, unknown>): SafetyDecision {
  const matched: SafetyReason[] = [];

  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';

    for (const pattern of DESTRUCTIVE_BASH_PATTERNS) {
      if (pattern.test(command)) {
        matched.push({ category: 'destructive', message: 'Destructive shell command detected' });
        break;
      }
    }

    for (const pattern of PRODUCTION_BASH_PATTERNS) {
      if (pattern.test(command)) {
        matched.push({ category: 'production', message: 'Production-impacting command detected' });
        break;
      }
    }

    for (const pattern of FILE_MUTATION_BASH_PATTERNS) {
      if (pattern.test(command)) {
        matched.push({ category: 'mutation', message: 'Filesystem mutation via shell detected' });
        break;
      }
    }

    // Extract and check file path tokens from command
    // Shell-aware tokenization: handles quotes and basic escaping
    const tokens = tokenizeShell(command);
    outer: for (const token of tokens) {
      // Check for path-like tokens
      if (
        token.startsWith('/') ||
        token.startsWith('./') ||
        token.startsWith('../') ||
        token.startsWith('~') ||
        /\.(env|pem|key|p12|pfx|json|ya?ml)$/i.test(token)
      ) {
        for (const pattern of SENSITIVE_PATH_PATTERNS) {
          if (pattern.test(token)) {
            matched.push({ category: 'sensitive', message: 'Access to sensitive path via shell detected' });
            break outer;
          }
        }
      }
    }
  }

  if (tool === 'write' || tool === 'edit') {
    const filePath = getStringProp(args, 'filePath') ?? '';
    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        matched.push({ category: 'sensitive', message: 'Sensitive file path detected' });
        break;
      }
    }
  }

  if (matched.length === 0) {
    return { hardSafety: false, action: 'allow', reasons: [] };
  }

  // Derive action from structured category, not display text
  const action: HardSafetyAction = matched.some((r) => CATEGORY_ACTION[r.category] === 'block')
    ? 'block'
    : 'ask';
  return { hardSafety: true, action, reasons: matched.map((r) => r.message) };
}
