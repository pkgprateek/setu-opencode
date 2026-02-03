import { existsSync } from 'fs';
import { join, normalize, isAbsolute, resolve, sep } from 'path';
import { 
  isSideEffectTool, 
  isSetuTool,
  isReadOnlyTool
} from '../constants';

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
    const rawSegments = rawAfter.split('/').filter(Boolean);

    const hasRawTraversal = rawSegments.some((segment) => segment === '..');
    const hasEncodedTraversal = rawSegments.some((segment) => /%2e|%2f|%5c/i.test(segment));

    if (hasRawTraversal || hasEncodedTraversal) {
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

export function shouldBlock(gear: Gear, tool: string, args: unknown): GearBlockResult {
  switch (gear) {
    case 'scout':
      // Only read-only tools or approved Setu tools allowed
      const scoutAllowedSetuTools = new Set(['setu_research', 'setu_doctor']);
      const isScoutAllowedSetuTool = isSetuTool(tool) && scoutAllowedSetuTools.has(tool);
      if (!isReadOnlyTool(tool) && !isScoutAllowedSetuTool) {
        return {
          blocked: true,
          reason: 'scout_blocked',
          details: `Tool '${tool}' blocked in Scout gear. Create RESEARCH.md first.`,
          gear
        };
      }
      return { blocked: false, gear };
    case 'architect':
      // Read + write to .setu/ only
      // If it's a side effect tool, it MUST be targeting .setu/ path
      if (!isReadOnlyTool(tool) && !isSetuTool(tool)) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Tool '${tool}' blocked in Architect gear. Only Setu or read-only tools are allowed.`,
          gear
        };
      }
      if (isSideEffectTool(tool) && !isSetuPath(args)) {
        return {
          blocked: true,
          reason: 'architect_blocked',
          details: `Tool '${tool}' blocked in Architect gear. Only .setu/ writes allowed until PLAN.md exists.`,
          gear
        };
      }
      return { blocked: false, gear };
    case 'builder':
      // All allowed (verification gate handled elsewhere)
      return { blocked: false, gear };
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
      return `🔍 [Scout Gear] ${result.details || 'Observation only.'}

Before making changes, gather context:
  1. Read relevant files to understand the codebase
  2. Use \`setu_research\` to save findings to .setu/RESEARCH.md
  
Once RESEARCH.md exists, you'll shift to Architect gear.`;

    case 'architect':
      return `📐 [Architect Gear] ${result.details || 'Planning phase.'}

You have research context. Now create a plan:
  1. Write to .setu/ directory only (PLAN.md, etc.)
  2. Use \`setu_plan\` to create .setu/PLAN.md
  
Once PLAN.md exists, you'll shift to Builder gear.`;

    case 'builder':
      // Builder never blocks via gears (verification is a separate gate)
      return '';
  }
}
