import { getStringProp } from '../utils';
import type { Gear } from './gears';

export type PolicyAction = 'execute' | 'ask' | 'block';

export interface ComplexityFactors {
  taskScope: number;
  repoSurface: number;
  riskSurface: number;
  uncertainty: number;
  blastRadius: number;
}

export interface PolicyDecision {
  score: number;
  factors: ComplexityFactors;
  hardSafety: boolean;
  action: PolicyAction;
  reason: string[];
}

interface EvaluatePolicyInput {
  tool: string;
  args: Record<string, unknown>;
  gear: Gear;
  hasActiveTask: boolean;
  hardSafety: boolean;
  hardSafetyReasons: string[];
  hardSafetyAction: 'ask' | 'block';
}

function clampFactor(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function isSimpleWrite(tool: string, args: Record<string, unknown>): boolean {
  if (tool !== 'write' && tool !== 'edit') return false;
  const filePath = getStringProp(args, 'filePath') ?? '';
  if (!filePath || filePath.startsWith('.setu/')) return true;
  return !filePath.includes('/');
}

function estimateTaskScope(tool: string, args: Record<string, unknown>): number {
  if (tool === 'write') {
    const content = getStringProp(args, 'content') ?? '';
    if (content.length <= 200) return 1.0;
    if (content.length <= 1500) return 2.0;
    return 3.5;
  }
  if (tool === 'edit') {
    return 2.5;
  }
  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';
    const tokenCount = command.trim().split(/\s+/).filter(Boolean).length;
    const hasChain = /&&|\|\||;/.test(command);
    if (tokenCount <= 3) return 1.5;
    if (tokenCount <= 8) return hasChain ? 3.0 : 2.5;
    return 4.0;
  }
  return 1.0;
}

function estimateRepoSurface(tool: string, args: Record<string, unknown>): number {
  if (tool === 'write' || tool === 'edit') {
    const filePath = getStringProp(args, 'filePath') ?? '';
    if (!filePath || filePath.startsWith('.setu/')) return 0.5;
    if (filePath.includes('/')) return 1.5;
    return 1.0;
  }
  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';
    const hasChain = /&&|\|\||;/.test(command);
    if (/\bgit\s+(commit|push|rebase|merge|reset|clean)\b/i.test(command)) return 4.0;
    if (/\b(build|test|lint|typecheck)\b/i.test(command)) return hasChain ? 2.8 : 2.0;
    return 1.5;
  }
  return 1.0;
}

function estimateRiskSurface(tool: string, args: Record<string, unknown>): number {
  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';
    const hasChain = /&&|\|\||;/.test(command);
    if (/\bgit\s+(push|reset|clean)\b/i.test(command)) return 5.0;
    if (/\b(build|test|lint|typecheck)\b/i.test(command)) return hasChain ? 3.0 : 2.5;
    return 2.0;
  }
  if (tool === 'edit') return 2.5;
  if (tool === 'write') return 1.5;
  return 1.0;
}

function estimateUncertainty(gear: Gear, hasActiveTask: boolean): number {
  if (gear === 'builder' && hasActiveTask) return 0.5;
  if (gear === 'architect') return 1.5;
  return 2.5;
}

function estimateBlastRadius(tool: string, args: Record<string, unknown>): number {
  if (tool === 'bash') {
    const command = getStringProp(args, 'command') ?? '';
    const hasChain = /&&|\|\||;/.test(command);
    if (/\bgit\s+push\b/i.test(command)) return 5.0;
    if (/\bgit\s+commit\b/i.test(command)) return 4.0;
    if (/\b(build|test|lint|typecheck)\b/i.test(command)) return hasChain ? 3.0 : 2.0;
    return 2.5;
  }
  if (tool === 'edit') return 2.5;
  if (tool === 'write') return 1.5;
  return 1.0;
}

export function evaluatePolicyDecision(input: EvaluatePolicyInput): PolicyDecision {
  if (input.hardSafety) {
    return {
      score: 5.0,
      factors: {
        taskScope: 5,
        repoSurface: 5,
        riskSurface: 5,
        uncertainty: 2,
        blastRadius: 5,
      },
      hardSafety: true,
      action: input.hardSafetyAction,
      reason: input.hardSafetyReasons,
    };
  }

  if (input.gear === 'builder' && input.hasActiveTask) {
    return {
      score: 1.0,
      factors: {
        taskScope: 1,
        repoSurface: 1,
        riskSurface: 1,
        uncertainty: 1,
        blastRadius: 1,
      },
      hardSafety: false,
      action: 'execute',
      reason: ['Active builder execution context'],
    };
  }

  const factors: ComplexityFactors = {
    taskScope: clampFactor(estimateTaskScope(input.tool, input.args)),
    repoSurface: clampFactor(estimateRepoSurface(input.tool, input.args)),
    riskSurface: clampFactor(estimateRiskSurface(input.tool, input.args)),
    uncertainty: clampFactor(estimateUncertainty(input.gear, input.hasActiveTask)),
    blastRadius: clampFactor(estimateBlastRadius(input.tool, input.args)),
  };

  let score =
    0.30 * factors.taskScope +
    0.20 * factors.repoSurface +
    0.20 * factors.riskSurface +
    0.15 * factors.uncertainty +
    0.15 * factors.blastRadius;

  if (isSimpleWrite(input.tool, input.args)) {
    score -= 0.8;
  }

  score = Math.max(0, Math.min(5, Number(score.toFixed(2))));

  const action: PolicyAction = score < 3 ? 'execute' : 'ask';
  const reason = [
    score < 3 ? 'Low complexity request' : 'Higher complexity request',
  ];

  return {
    score,
    factors,
    hardSafety: false,
    action,
    reason,
  };
}
