import { existsSync } from 'fs';
import { join, normalize, isAbsolute, resolve, sep } from 'path';
import { 
  isSideEffectTool
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

/**
 * Determine if a tool should be blocked based on the current gear.
 *
 * IMPORTANT: This is a post-hydration enforcement check that assumes hydration/context
 * has already been confirmed. For pre-hydration checks (blocking unknown tools before
 * context is confirmed), use shouldBlockDuringHydration() which implements fail-closed
 * security for unknown tools.
 *
 * Calling shouldBlock() directly without passing the hydration gate may allow unknown
 * tools to execute. For defense-in-depth, ensure shouldBlockDuringHydration() is called
 * first for any tool execution before reaching this gear-based check.
 *
 * @param gear - Current gear (scout, architect, builder)
 * @param tool - Tool name being invoked
 * @param args - Tool arguments
 * @returns GearBlockResult indicating if the tool is blocked and why
 */
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
      // Block side-effect tools (write, edit, patch, etc.)
      if (isSideEffectTool(tool)) {
        return {
          blocked: true,
          reason: 'scout_blocked',
          details: `Tool '${tool}' blocked in Scout gear. Create RESEARCH.md first.`,
          gear
        };
      }
      
      // Block non-read-only bash commands
      if (tool === 'bash' && !isReadOnlyBash) {
        return {
          blocked: true,
          reason: 'scout_blocked',
          details: `Bash command blocked in Scout gear. Use read-only commands only.`,
          gear
        };
      }
      
      // Allow everything else (read-only tools, setu tools, research tools, safe bash)
      return { blocked: false, gear };
    }
    case 'architect': {
      // Allow: read-only tools, setu tools, research tools, read-only bash
      // Block: side-effect tools outside .setu/, non-read-only bash
      
      // Block side-effect tools outside .setu/ (write, edit, patch, multiedit, etc.)
      if (isSideEffectTool(tool) && !isSetuPath(args)) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Tool '${tool}' blocked in Architect gear. Only .setu/ writes allowed until PLAN.md exists.`,
          gear
        };
      }
      
      // Block non-read-only bash (prevents cat > src/main.ts bypass)
      if (tool === 'bash' && !isReadOnlyBash) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Non-read-only bash blocked in Architect gear. Use write/edit tools for file changes, or read-only commands for inspection.`,
          gear
        };
      }
      
      // Allow everything else (research tools, read-only tools, setu tools, read-only bash, side-effect in .setu/)
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
      return `Call setu_research({ task: "...", summary: "..." }) first to document findings and advance.`;

    case 'architect':
      return `Research phase complete. You may continue researching or call setu_plan({ objective: "...", steps: "..." }) when ready to create implementation plan.`;

    case 'builder':
      // Builder never blocks via gears (verification is a separate gate)
      return '';
    default:
      return `Return to Scout gear and re-establish workflow artifacts.`;
  }
}
