/**
 * Secrets detection for preventing accidental leaks
 * 
 * Scans content for common secret patterns before write/edit operations.
 */

/**
 * Common patterns for secrets and credentials
 * 
 * Each pattern includes:
 * - regex: The detection pattern
 * - name: Human-readable name for reporting
 * - severity: How critical this secret type is
 */
export const SECRET_PATTERNS = [
  // API Keys
  {
    regex: /\bsk-[A-Za-z0-9]{32,}(?:T3BlbkFJ[A-Za-z0-9]{20})?\b/g,
    name: 'OpenAI API Key',
    severity: 'critical' as const
  },
  {
    regex: /\bsk-ant-[A-Za-z0-9-]{90,}\b/g,
    name: 'Anthropic API Key',
    severity: 'critical' as const
  },
  {
    regex: /\bAIza[A-Za-z0-9_-]{35}\b/g,
    name: 'Google API Key',
    severity: 'high' as const
  },
  
  // AWS
  {
    regex: /\bAKIA[A-Z0-9]{16}\b/g,
    name: 'AWS Access Key ID',
    severity: 'critical' as const
  },
  {
    regex: /\b[A-Za-z0-9/+=]{40}\b/g,  // Broad, but checked with context
    name: 'AWS Secret Key (possible)',
    severity: 'medium' as const,
    requiresContext: true  // Only flag if near "aws" or "secret"
  },
  
  // GitHub
  {
    regex: /\bghp_[A-Za-z0-9]{36}\b/g,
    name: 'GitHub Personal Access Token',
    severity: 'critical' as const
  },
  {
    regex: /\bgho_[A-Za-z0-9]{36}\b/g,
    name: 'GitHub OAuth Token',
    severity: 'critical' as const
  },
  {
    regex: /\bghu_[A-Za-z0-9]{36}\b/g,
    name: 'GitHub User-to-Server Token',
    severity: 'critical' as const
  },
  {
    regex: /\bghs_[A-Za-z0-9]{36}\b/g,
    name: 'GitHub Server-to-Server Token',
    severity: 'critical' as const
  },
  {
    regex: /\bghr_[A-Za-z0-9]{36}\b/g,
    name: 'GitHub Refresh Token',
    severity: 'critical' as const
  },
  
  // Stripe
  {
    regex: /\bsk_live_[A-Za-z0-9]{24,}\b/g,
    name: 'Stripe Live Secret Key',
    severity: 'critical' as const
  },
  {
    regex: /\bsk_test_[A-Za-z0-9]{24,}\b/g,
    name: 'Stripe Test Secret Key',
    severity: 'medium' as const
  },
  {
    regex: /\brk_live_[A-Za-z0-9]{24,}\b/g,
    name: 'Stripe Restricted Key',
    severity: 'critical' as const
  },
  
  // Slack
  {
    regex: /\bxox[baprs]-[0-9]{10,}-[A-Za-z0-9-]{24,}\b/g,
    name: 'Slack Token',
    severity: 'high' as const
  },
  
  // NPM
  {
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
    name: 'NPM Access Token',
    severity: 'high' as const
  },
  
  // Private Keys (generic patterns)
  {
    regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    name: 'Private Key Header',
    severity: 'critical' as const
  },
  {
    regex: /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,
    name: 'OpenSSH Private Key',
    severity: 'critical' as const
  },
  
  // JWT (might contain sensitive claims)
  {
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    name: 'JWT Token',
    severity: 'medium' as const
  },
  
  // Generic patterns (high false positive, use with context)
  {
    regex: /password\s*[=:]\s*['"]?[A-Za-z0-9!@#$%^&*]{8,}['"]?/gi,
    name: 'Hardcoded Password',
    severity: 'high' as const
  },
  {
    regex: /api[_-]?key\s*[=:]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/gi,
    name: 'Generic API Key',
    severity: 'medium' as const
  },
  {
    regex: /secret\s*[=:]\s*['"]?[A-Za-z0-9!@#$%^&*_-]{16,}['"]?/gi,
    name: 'Generic Secret',
    severity: 'medium' as const
  }
] as const;

/**
 * A detected secret match
 */
export interface SecretMatch {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  redactedMatch: string;  // The matched text (redacted for safety)
  line?: number;
}

/**
 * Check if a match passes context requirements
 * 
 * For patterns with requiresContext: true, validates that context keywords
 * (like 'aws' or 'secret') appear within ±50 characters of the match.
 * 
 * @param pattern - The secret pattern being tested
 * @param content - The full content being scanned
 * @param matchIndex - Start index of the match
 * @param matchLength - Length of the matched string
 * @returns true if context check passes or is not required
 */
function passesContextCheck(
  pattern: typeof SECRET_PATTERNS[number],
  content: string,
  matchIndex: number,
  matchLength: number
): boolean {
  if (!('requiresContext' in pattern) || !pattern.requiresContext) {
    return true;
  }
  
  const contextWindow = content.slice(
    Math.max(0, matchIndex - 50),
    Math.min(content.length, matchIndex + matchLength + 50)
  ).toLowerCase();
  
  return contextWindow.includes('aws') || contextWindow.includes('secret');
}

/**
 * Detect secrets in content
 * 
 * @param content - The content to scan
 * @returns Array of detected secret matches
 */
export function detectSecrets(content: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state (important for global patterns)
    pattern.regex.lastIndex = 0;
    
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      // Skip patterns requiring context if context keywords not present
      if (!passesContextCheck(pattern, content, match.index, match[0].length)) {
        continue;
      }
      
      // Find line number
      const beforeMatch = content.slice(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      // Redact the actual match for safety in logging
      const redactedMatch = match[0].slice(0, 8) + '...[REDACTED]';
      
      matches.push({
        name: pattern.name,
        severity: pattern.severity,
        redactedMatch,
        line: lineNumber
      });
    }
  }
  
  return matches;
}

/**
 * Quick check if content contains any secrets
 * 
 * @param content - The content to check
 * @returns true if secrets are detected
 */
export function containsSecrets(content: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;  // Reset regex state
    
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      // Skip patterns requiring context if context keywords not present
      if (!passesContextCheck(pattern, content, match.index, match[0].length)) {
        continue;
      }
      
      // Found a valid secret match
      return true;
    }
  }
  return false;
}
