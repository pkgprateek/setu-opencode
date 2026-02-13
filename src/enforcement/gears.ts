import { existsSync } from 'fs';
import { join, normalize, isAbsolute, resolve, sep } from 'path';
import { 
  isSideEffectTool, 
  isSetuTool,
  isReadOnlyTool
} from '../constants';
import { isReadOnlyBashCommand } from './hydration';
import { debugLog } from '../debug';

export type Gear = 'scout' | 'architect' | 'builder';

export interface GearState {
  current: Gear;
  artifacts: {
    research: boolean;  // .setu/RESEARCH.md exists
    plan: boolean;      // .setu/PLAN.md exists
  };
  determinedAt: number; // Timestamp
}

export function determineGear(projectDir: string): GearState {
  const researchExists = existsSync(join(projectDir, '.setu', 'RESEARCH.md'));
  const planExists = existsSync(join(projectDir, '.setu', 'PLAN.md'));
  
  let current: Gear;
  if (!researchExists) {
    current = 'scout';
  } else if (!planExists) {
    current = 'architect';
  } else {
    current = 'builder';
  }
  
  return {
    current,
    artifacts: { research: researchExists, plan: planExists },
    determinedAt: Date.now()
  };
}

/**
 * Check if a path is safely within the .setu/ directory
 * 
 * SECURITY: Prevents path traversal attacks:
 * - Rejects absolute paths (must be relative to project)
 * - Normalizes to collapse .. segments
 * - Verifies result starts with .setu/ or is exactly .setu
 * 
 * @param args - Tool arguments that may contain path properties
 * @returns true if path is safely within .setu/
 */
function isSetuPath(args: unknown): boolean {
  if (!args || typeof args !== 'object') return false;
  
  // Check common path arguments
  const pathArg = (args as Record<string, unknown>).path || 
               (args as Record<string, unknown>).filePath || 
               (args as Record<string, unknown>).file_path;
               
  if (typeof pathArg !== 'string') return false;

  // SECURITY: Reject control characters and null bytes
  if (/\p{Cc}/u.test(pathArg)) {
    return false;
  }
  
  // Normalize path separators for consistent checking (handle Windows backslashes)
  const normalizedInput = pathArg.replace(/\\/g, '/');
  
  // SECURITY: Reject absolute paths - must be relative to project
  if (isAbsolute(pathArg)) {
    // Allow absolute paths that contain .setu if they're properly formatted
    // e.g., /Users/project/.setu/file.md
    // But still need to verify no traversal after .setu
    const setuMarker = '/.setu';
    const setuIndex = normalizedInput.indexOf(setuMarker);
    
    if (setuIndex === -1) {
      return false;
    }
    
    // Extract the part after .setu (skip the marker itself)
    const afterSetu = normalizedInput.substring(setuIndex + setuMarker.length);
    
    // afterSetu should be empty (path is exactly /.setu) or start with /
    if (afterSetu.length > 0 && !afterSetu.startsWith('/')) {
      return false;
    }
    
    // Normalize and check for traversal out of .setu
    const normalizedAfter = normalize(afterSetu).replace(/\\/g, '/');

    // Inspect raw segments after .setu for traversal
    const rawAfter = normalizedInput
      .substring(setuIndex + setuMarker.length)
      .replace(/^\//, '');
    
    // SECURITY: Handle double-encoding attacks (e.g., %252e → %2e → .)
    // Repeatedly decode until string stabilizes or max iterations reached
    let decodedAfter = rawAfter;
    const MAX_DECODE_ITERATIONS = 5;
    for (let i = 0; i < MAX_DECODE_ITERATIONS; i++) {
      try {
        const nextDecode = decodeURIComponent(decodedAfter);
        if (nextDecode === decodedAfter) {
          // Stabilized - no more encoding
          break;
        }
        decodedAfter = nextDecode;
      } catch {
        // Invalid encoding - stop decoding, use what we have
        break;
      }
    }
    
    // Check both raw and decoded segments for traversal
    const rawSegments = rawAfter.split('/').filter(Boolean);
    const decodedSegments = decodedAfter.split('/').filter(Boolean);

    const hasRawTraversal = rawSegments.some((segment) => segment === '..');
    const hasDecodedTraversal = decodedSegments.some((segment) => segment === '..');
    
    // Check for encoded traversal patterns in raw input
    // (catches single-encoded like %2e%2e before decoding)
    const hasEncodedTraversal = rawSegments.some((segment) => /%2e|%2f|%5c/i.test(segment));

    if (hasRawTraversal || hasDecodedTraversal || hasEncodedTraversal) {
      return false;
    }

    // Reject if traversal detected (.. anywhere after normalization)
    if (normalizedAfter.includes('..')) {
      return false;
    }

    // Resolve and ensure path remains within .setu directory
    const setuRoot = normalizedInput.substring(0, setuIndex + setuMarker.length);
    const resolvedInput = resolve(pathArg);
    const resolvedSetuDir = resolve(setuRoot);
    const setuBoundary = resolvedSetuDir.endsWith(sep) ? resolvedSetuDir : `${resolvedSetuDir}${sep}`;
    if (resolvedInput !== resolvedSetuDir && !resolvedInput.startsWith(setuBoundary)) {
      return false;
    }

    return true;
  }
  
  // Normalize to collapse .. segments
  const normalizedPath = normalize(pathArg).replace(/\\/g, '/');
  
  // SECURITY: If normalization reveals traversal (starts with ..), reject
  if (normalizedPath.startsWith('..')) {
    return false;
  }
  
  // Path must be exactly .setu or start with .setu/
  return normalizedPath === '.setu' || 
         normalizedPath.startsWith('.setu/');
}

export interface GearBlockResult {
  blocked: boolean;
  reason?: string;
  details?: string;
  gear: Gear;
}

/** Scout gear: only these Setu tools are allowed (hoisted to module scope for performance) */
const SCOUT_ALLOWED_SETU_TOOLS = new Set(['setu_task', 'setu_context', 'setu_research', 'setu_doctor', 'setu_feedback']);

export function shouldBlock(gear: Gear, tool: string, args: unknown): GearBlockResult {
  let isReadOnlyBash = false;
  if (tool === 'bash' && typeof (args as Record<string, unknown> | undefined)?.command === 'string') {
    try {
      isReadOnlyBash = isReadOnlyBashCommand((args as Record<string, unknown>).command as string);
    } catch {
      // Fail closed: treat unparseable command as mutating.
      isReadOnlyBash = false;
    }
  }

  switch (gear) {
    case 'scout': {
      // Only read-only tools or approved Setu tools allowed
      const isScoutAllowedSetuTool = isSetuTool(tool) && SCOUT_ALLOWED_SETU_TOOLS.has(tool);
      if (!isReadOnlyTool(tool) && !isScoutAllowedSetuTool && !isReadOnlyBash) {
        return {
          blocked: true,
          reason: 'scout_blocked',
          details: `Tool '${tool}' blocked in Scout gear. Create RESEARCH.md first.`,
          gear
        };
      }
      return { blocked: false, gear };
    }
    case 'architect': {
      // Read + write to .setu/ only
      // If it's a side effect tool, it MUST be targeting .setu/ path
      if (!isReadOnlyTool(tool) && !isSetuTool(tool) && !isReadOnlyBash) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Tool '${tool}' blocked in Architect gear. Only Setu or read-only tools are allowed.`,
          gear
        };
      }
      if (tool !== 'bash' && isSideEffectTool(tool) && !isSetuPath(args)) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Tool '${tool}' blocked in Architect gear. Only .setu/ writes allowed until PLAN.md exists.`,
          gear
        };
      }
      return { blocked: false, gear };
    }
    case 'builder': {
      // All allowed (verification gate handled elsewhere)
      return { blocked: false, gear };
    }
    default: {
      const unknownGear = String(gear);
      debugLog(`Unknown gear '${unknownGear}' encountered in shouldBlock; blocking by default.`);
      return {
        blocked: true,
        reason: 'unknown_gear',
        details: `Gear '${unknownGear}' is not recognized. Blocking by default. [received_gear=${unknownGear}]`,
        gear: 'scout',
      };
    }
  }
}

/**
 * Create human-readable block message for gear enforcement
 * 
 * @param result - The GearBlockResult from shouldBlock()
 * @returns User-friendly message explaining the block
 */
export function createGearBlockMessage(result: GearBlockResult): string {
  switch (result.gear) {
    case 'scout':
      return `Wait: Call setu_research({ task: "...", summary: "..." }) first to document findings and advance.`;

    case 'architect':
      return `Wait: Call setu_plan({ objective: "...", steps: "..." }) first, then ask user "Ready?".`;

    case 'builder':
      // Builder never blocks via gears (verification is a separate gate)
      return '';
    default:
      return `Wait: Return to Scout gear and re-establish workflow artifacts.`;
  }
}
