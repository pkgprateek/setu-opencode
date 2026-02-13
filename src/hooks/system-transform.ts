/**
 * System transform hook - Injects dynamic state into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * IMPORTANT: This hook injects dynamic state AND loaded context.
 * The full persona is already in the agent file (.opencode/agents/setu.md).
 * 
 * When in Setu mode: Check file availability + project rules + context content + read history
 * When in Build/Plan: Does nothing (Setu is off)
 */

import { getStateInjection, type FileAvailability } from '../prompts/persona';
import {
  type ContextCollector,
  contextToSummary,
  formatContextForInjection,
  type ProjectRules,
  formatRulesForInjection,
  hasProjectRules,
  getJITContextSummary,
  loadActiveTask,
  getDisciplineState,
  getOverwriteRequirement,
} from '../context';
import { determineGear } from '../enforcement';
import { debugLog } from '../debug';
import { getErrorMessage } from '../utils/error-handling';

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
 * - [Setu]
 * - [Context: AGENTS.md, .setu/context.json]
 * - Silent Exploration: Project rules (AGENTS.md, CLAUDE.md, active task)
 * - Loaded context content (summary, constraints, patterns)
 * - [FILES ALREADY READ]: List of files already read (prevents re-reading)
 * 
 * Does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 */
/** Input shape for the system transform hook */
interface SystemTransformInput {
  sessionID: string;
  message?: { content?: string };
}

/** Output shape for the system transform hook */
interface SystemTransformOutput {
  system: string[];
}

/** Hook signature returned by createSystemTransformHook */
type SystemTransformHook = (
  input: SystemTransformInput,
  output: SystemTransformOutput
) => Promise<void>;

export function createSystemTransformHook(
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> },
  getSetuFilesExist?: () => FileAvailability,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getProjectRules?: () => ProjectRules | null,
  getProjectDir?: () => string
): SystemTransformHook {
  return async (
    input: SystemTransformInput,
    output: SystemTransformOutput
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
    
    const isDefault = true;
    
    // Get file availability for context injection
    const filesExist: FileAvailability = getSetuFilesExist 
      ? getSetuFilesExist() 
      : { active: false, context: false, agentsMd: false, claudeMd: false };
    
    // Inject minimal state - and file availability
    const stateInjection = getStateInjection(filesExist, isDefault);
    output.system.push(stateInjection);
    
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
    
    // Add verification reminder when needed
    const verificationState = getVerificationState();
    if (!verificationState.complete) {
      const stepsNeeded = ['build', 'test', 'lint'].filter(
        s => !verificationState.stepsRun.has(s)
      );

      if (stepsNeeded.length > 0) {
        output.system.push(`[Verify before done: ${stepsNeeded.join(', ')}]`);
      }
    }

    // Gear, discipline, and overwrite injection — wrapped for graceful degradation
    // I/O errors here (e.g., determineGear reads filesystem) should not crash the hook
    try {
      if (getProjectDir) {
        const projectDir = getProjectDir();
        const gearState = determineGear(projectDir);

        output.system.unshift(`[SETU: Gear] ${gearState.current}`);

        switch (gearState.current) {
          case 'scout':
            output.system.unshift(
              '[SETU: Workflow] Research the codebase and task. Save findings with setu_research.'
            );
            break;
          case 'architect':
            output.system.unshift(
              '[SETU: Workflow] Create an implementation plan. Save with setu_plan. Ask user to confirm before executing.'
            );
            break;
          case 'builder':
            output.system.unshift(
              '[SETU: Workflow] Execute the plan step by step. Run setu_verify before declaring done.'
            );
            break;
        }
      }

      const disciplineState = getDisciplineState(input.sessionID);
      if (disciplineState.questionBlocked) {
        output.system.unshift(
          `[SETU: Clarification Required]\n` +
            `Resolve the pending decision before implementation.\n` +
            `Use native question tool when available; otherwise use setu_context as explicit decision checkpoint.\n` +
            `Do not execute implementation tools until the decision is resolved.`
        );
      }

      const overwriteRequirement = getOverwriteRequirement(input.sessionID);
      if (overwriteRequirement?.pending) {
        // Sanitize filePath before interpolation: strip control chars and newlines
        const safePath = (overwriteRequirement.filePath ?? '')
          .replace(/\n/g, ' ')
          .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '');
        output.system.unshift(
          `[SETU: Overwrite Guard]\n` +
            `Pending requirement: read '${safePath}' before any mutation.\n\n` +
            `Next action must be read on that file.\n` +
            `Do not use bash/write/edit as a workaround.`
        );
      }
    } catch (error) {
      // Graceful degradation: gear/discipline injection is enhancement, not critical
      debugLog('Gear/discipline injection failed:', getErrorMessage(error));
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
        debugLog('JIT context injection failed:', getErrorMessage(error));
      }
    }

  };
}
