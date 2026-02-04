/**
 * System transform hook - Injects dynamic state into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * IMPORTANT: This hook injects dynamic state AND loaded context.
 * The full persona is already in the agent file (.opencode/agents/setu.md).
 * 
 * When in Setu mode: Injects style + file availability + project rules + context content + read history
 * When in Build/Plan: Does nothing (Setu is off)
 */

import { getStateInjection, type FileAvailability } from '../prompts/persona';
import { detectStyle, isStyleOnlyCommand, type StyleState } from '../prompts/styles';
import {
  type ContextCollector,
  contextToSummary,
  formatContextForInjection,
  type ProjectRules,
  formatRulesForInjection,
  hasProjectRules,
  getJITContextSummary,
  loadActiveTask,
} from '../context';
import { debugLog } from '../debug';

/**
 * Format files already read for injection into system prompt
 * 
 * This prevents the "Loop of Stupid" - re-reading files the agent already read.
 * Token-efficient: just paths, not content.
 * 
 * @param filesRead - Array of file paths that have been read
 * @returns Formatted injection string or empty string if no files
 */
function formatFilesAlreadyRead(filesRead: Array<{ path: string }>): string {
  if (filesRead.length === 0) return '';
  
  // Limit to last 50 files to avoid bloating system prompt
  const recentFiles = filesRead.slice(-50);
  const paths = recentFiles.map(f => f.path).join(', ');
  
  return `[FILES ALREADY READ]: ${paths}`;
}

/**
 * Creates the system transform hook
 * 
 * Injects:
 * - [Style: Ultrathink] (or current style)
 * - [Context: AGENTS.md, .setu/context.json]
 * - Silent Exploration: Project rules (AGENTS.md, CLAUDE.md, active task)
 * - Loaded context content (summary, constraints, patterns)
 * - [FILES ALREADY READ]: List of files already read (prevents re-reading)
 * 
 * Does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 */
export function createSystemTransformHook(
  getStyleState: () => StyleState,
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> },
  getSetuFilesExist?: () => FileAvailability,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getProjectRules?: () => ProjectRules | null,
  getProjectDir?: () => string
  // NOTE: setStyleState intentionally removed - state mutation is handled by chat.message hook, not here.
  // The transform must remain pure (no side effects).
) {
  return async (
    input: { sessionID: string; message?: { content?: string } },
    output: { system: string[] }
  ): Promise<void> => {
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    const agentLower = currentAgent.toLowerCase();

    // Define which agents should receive Setu injections
    // Setu: Full persona + all injections
    // Subagents (explore, general): JIT context only (for task awareness)
    // Build/Plan: No Setu injections
    const isSetuAgent = agentLower === 'setu';
    const isSubagent = ['explore', 'general'].includes(agentLower);

    // Only inject for Setu or known subagents
    if (!isSetuAgent && !isSubagent) {
      return;
    }
    
    const styleState = getStyleState();
    
    // Detect style from user message for this prompt injection only.
    // NOTE: State persistence is handled by chat.message hook, NOT here.
    // The transform must remain pure - no side effects.
    let effectiveStyle = styleState.current;
    let isStyleOnly = false;
    if (input.message?.content) {
      const detected = detectStyle(input.message.content);
      if (detected) {
        effectiveStyle = detected.style;
        // DO NOT call setStyleState here - that's the chat.message hook's job.
        // We only use detected style for injection in THIS prompt.
      }
      isStyleOnly = isStyleOnlyCommand(input.message.content);
    }
    
    const isDefault = effectiveStyle === 'ultrathink';
    
    // Get file availability for context injection
    const filesExist: FileAvailability = getSetuFilesExist 
      ? getSetuFilesExist() 
      : { active: false, context: false, agentsMd: false, claudeMd: false };
    
    // Inject minimal state - style and file availability
    const stateInjection = getStateInjection(effectiveStyle, filesExist, isDefault);
    output.system.push(stateInjection);

    // Style-only switch: acknowledge and ask for task before acting
    if (isStyleOnly) {
      const prompt = effectiveStyle === 'collab'
        ? 'Style switch only. Acknowledge the mode change, ask what to work on next, and offer to capture the discussion as RESEARCH/PLAN if the user wants it preserved. Do not start any actions.'
        : 'Style switch only. Acknowledge the mode change and ask what to work on next. Do not start any actions.';
      output.system.push(prompt);
    }
    
    // SILENT EXPLORATION: Inject project rules (AGENTS.md, CLAUDE.md, active task)
    // This happens BEFORE context injection because rules are foundational
    if (getProjectRules) {
      const projectRules = getProjectRules();
      if (projectRules && hasProjectRules(projectRules)) {
        const rulesInjection = formatRulesForInjection(projectRules);
        output.system.push(rulesInjection);
      }
    }
    
    // CRITICAL: Inject loaded context content (summary, constraints, patterns)
    // This ensures constraints like "sandbox only" survive restarts
    if (getContextCollector) {
      const collector = getContextCollector();
      if (collector) {
        const context = collector.getContext();
        
        // Inject FILES ALREADY READ to prevent re-reading
        // This is always useful, even if context isn't confirmed yet
        if (context.filesRead.length > 0) {
          output.system.push(formatFilesAlreadyRead(context.filesRead));
        }
        
        // Only inject full context if confirmed and meaningful
        if (context.confirmed && (context.summary || context.patterns.length > 0 || context.currentTask)) {
          const summary = contextToSummary(context);
          const contextBlock = formatContextForInjection(summary);
          output.system.push(contextBlock);
        }
      }
    }
    
    // Add verification reminder for ultrathink style when needed
    const verificationState = getVerificationState();
    if (effectiveStyle === 'ultrathink' && !verificationState.complete) {
      const stepsNeeded = ['build', 'test', 'lint'].filter(
        s => !verificationState.stepsRun.has(s)
      );

      if (stepsNeeded.length > 0) {
        output.system.push(`[Verify before done: ${stepsNeeded.join(', ')}]`);
      }
    }

    // JIT Context Injection: Inject active task context for subagent awareness
    // This provides step tracking, failed approaches, and constraints
    // CRITICAL: Subagents need this to know which step to execute
    if (getProjectDir) {
      try {
        const projectDir = getProjectDir();
        const active = loadActiveTask(projectDir);

        if (active && active.progress && active.progress.lastCompletedStep >= 0) {
          const jitSummary = getJITContextSummary(projectDir);

          // Build JIT injection
          const jitParts: string[] = [];

          if (jitSummary.objective) {
            jitParts.push(`## Current Task\n${jitSummary.objective}`);
          }

          if (jitSummary.failedApproaches.length > 0) {
            jitParts.push(`## Failed Approaches (DO NOT REPEAT)\n${jitSummary.failedApproaches.map(a => `- ${a}`).join('\n')}`);
          }

          if (jitSummary.constraints.length > 0) {
            jitParts.push(`## Active Constraints\n${jitSummary.constraints.map(c => `- ${c}`).join('\n')}`);
          }

          if (jitParts.length > 0) {
            const jitInjection = `[SETU: JIT Context]\n\n${jitParts.join('\n\n')}\n\n---\n`;
            // Prepend to system array so it appears first
            output.system.unshift(jitInjection);
          }
        }
      } catch (error) {
        // Graceful degradation: JIT context is enhancement, not critical
        // Log for debugging but don't crash OpenCode
        debugLog('JIT context injection failed:', error instanceof Error ? error.message : error);
      }
    }

  };
}
