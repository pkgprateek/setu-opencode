/**
 * Token Status Tracking (Proactive Context Warning)
 * 
 * Reads token usage from OpenCode's session history.
 * OpenCode already receives accurate token counts from the model provider's API.
 * We just need to read them and calculate percentage.
 * 
 * Usage:
 * - Check context usage percentage
 * - Warn user before quality degrades
 * - Suggest clearing/compacting when needed
 */

import type { PluginInput } from '@opencode-ai/plugin';
import { debugLog, errorLog } from '../debug';

/**
 * Token usage status for a session.
 */
export interface TokenStatus {
  /** Current tokens filling the context window */
  used: number;
  /** Max tokens allowed by the model */
  limit: number;
  /** Percentage of context used (0-100) */
  percentage: number;
}

/**
 * Token thresholds for warnings.
 * 
 * Based on research showing LLM quality degrades after ~50K tokens.
 */
export const TOKEN_THRESHOLDS = {
  /** Proactive warning - suggest clearing after task */
  WARNING: 70,
  /** Approaching limit - strong suggestion */
  CRITICAL: 85,
  /** Emergency - compaction imminent */
  EMERGENCY: 95,
} as const;

/**
 * Severity level based on token percentage.
 */
export type TokenSeverity = 'ok' | 'warning' | 'critical' | 'emergency';

/**
 * Get current token usage for a session.
 * 
 * Reads accurate token counts from OpenCode's session history
 * (already tracked from model provider API responses).
 * 
 * @param client - OpenCode client from plugin context
 * @param sessionID - Session identifier
 * @returns Token status or null if unavailable
 */
export async function getTokenStatus(
  client: PluginInput['client'],
  sessionID: string
): Promise<TokenStatus | null> {
  try {
    // 1. Get session messages
    const messages = await client.session.messages({
      path: { id: sessionID }
    });
    
    if (messages.error || !messages.data?.length) {
      debugLog('Token status: No messages found');
      return null;
    }
    
    // 2. Find the last assistant message (contains most recent token counts)
    // Using reverse + find instead of findLast for ES2022 compatibility
    const lastMsg = [...messages.data].reverse().find(m => m.info.role === 'assistant');
    
    if (!lastMsg) {
      debugLog('Token status: No assistant message found');
      return null;
    }
    
    // Cast to assistant message info which has tokens
    // We know it's an assistant message because we filtered for role === 'assistant'
    const assistantInfo = lastMsg.info as {
      role: 'assistant';
      tokens?: {
        input?: number;
        output?: number;
        reasoning?: number;
        max_output_tokens?: number;
        cache?: { read?: number; write?: number };
      };
      providerID?: string;
      modelID?: string;
    };
    
    // Validate expected structure exists
    if (typeof assistantInfo !== 'object' || assistantInfo === null) {
      debugLog('Token status: Unexpected message info structure');
      return null;
    }
    
    if (!assistantInfo.tokens) {
      debugLog('Token status: No token data in last message');
      return null;
    }
    
    const t = assistantInfo.tokens;
    
    // 3. Calculate usage (mirror OpenCode's overflow calculation)
    // OpenCode checks: input_tokens + max_output_tokens > model_context_limit
    // We include: input + cached reads + requested output budget
    const used = (t.input ?? 0) + (t.cache?.read ?? 0) + (t.max_output_tokens ?? 0);
    
    // 4. Get model's context limit
    const providers = await client.provider.list();
    
    if (providers.error || !providers.data) {
      debugLog('Token status: Could not get provider list');
      return null;
    }
    
    // Find the provider and model used
    const providerID = assistantInfo.providerID;
    const modelID = assistantInfo.modelID;
    
    if (!providerID || !modelID) {
      debugLog('Token status: Missing provider/model ID');
      return null;
    }
    
    const provider = providers.data.all.find(p => p.id === providerID);
    const model = provider?.models[modelID];
    const limit = model?.limit?.context ?? 0;
    
    if (limit === 0) {
      debugLog('Token status: Model has no context limit defined');
      return null;
    }
    
    const percentage = Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
    
    debugLog(`Token status: ${percentage}% (${used}/${limit})`);
    
    return {
      used,
      limit,
      percentage,
    };
    
  } catch (error) {
    errorLog('Failed to get token status:', error);
    return null;
  }
}

/**
 * Determine severity level based on percentage.
 * 
 * @param percentage - Context usage percentage (0-100)
 * @returns Severity level
 */
export function getTokenSeverity(percentage: number): TokenSeverity {
  if (percentage >= TOKEN_THRESHOLDS.EMERGENCY) return 'emergency';
  if (percentage >= TOKEN_THRESHOLDS.CRITICAL) return 'critical';
  if (percentage >= TOKEN_THRESHOLDS.WARNING) return 'warning';
  return 'ok';
}

/**
 * Get a human-readable warning message for the severity level.
 * 
 * @param percentage - Context usage percentage
 * @param severity - Current severity level
 * @returns Warning message or null if no warning needed
 */
export function getTokenWarningMessage(
  percentage: number,
  severity: TokenSeverity
): string | null {
  switch (severity) {
    case 'warning':
      return `Context is ${percentage}% full. Consider clearing session after this task to maintain quality.`;
    case 'critical':
      return `Context is ${percentage}% full. Strongly recommend clearing session to prevent quality degradation.`;
    case 'emergency':
      return `Context is ${percentage}% full. OpenCode will compact soon. Quality may degrade.`;
    default:
      return null;
  }
}
