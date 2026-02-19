import { describe, test, expect, mock } from 'bun:test';
import { createSystemTransformHook } from '../system-transform';
import type { FileAvailability } from '../../prompts/persona';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

// Helper to create temporary test directories with specific gear state
function createTestDir(gear: 'scout' | 'architect' | 'builder'): string {
  const tmpDir = mkdtempSync(join(tmpdir(), 'setu-test-'));
  
  // Create .setu directory
  const setuDir = join(tmpDir, '.setu');
  mkdirSync(setuDir, { recursive: true });
  
  if (gear === 'architect' || gear === 'builder') {
    // Create RESEARCH.md for architect/builder
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# Test Research');
  }
  
  if (gear === 'builder') {
    // Create PLAN.md for builder
    writeFileSync(join(setuDir, 'PLAN.md'), '# Test Plan');
  }
  
  return tmpDir;
}

describe('system-transform gear messages', () => {
  test('Scout gear message explicitly allows research', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetCurrentAgent = () => 'setu';
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        mockGetCurrentAgent,
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const scoutMessage = output.system.find((s: string) => s.includes('Scout Mode'));
      expect(scoutMessage).toBeDefined();
      expect(scoutMessage?.includes('Discovery Phase')).toBe(true);
      expect(scoutMessage?.includes('non-destructive discovery tools')).toBe(true);
      expect(scoutMessage?.includes('You are not required to plan yet')).toBe(true);
      expect(scoutMessage?.includes('You may update research artifacts via setu_research')).toBe(true);
      expect(scoutMessage?.includes('Action:')).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Architect gear message explicitly allows continued research', async () => {
    const testDir = createTestDir('architect');
    
    try {
      const mockGetCurrentAgent = () => 'setu';
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        mockGetCurrentAgent,
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const architectMessage = output.system.find((s: string) => s.includes('Architect Mode'));
      expect(architectMessage).toBeDefined();
      expect(architectMessage?.includes('Synthesis Phase')).toBe(true);
      expect(architectMessage?.includes('You may continue discovery')).toBe(true);
      expect(architectMessage?.includes('plan when ready')).toBe(true);
      expect(architectMessage?.includes('No forced transition')).toBe(true);
      expect(architectMessage?.includes('Action:')).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Builder gear message has softer discovery guidance', async () => {
    const testDir = createTestDir('builder');
    
    try {
      const mockGetCurrentAgent = () => 'setu';
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        mockGetCurrentAgent,
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const builderMessage = output.system.find((s: string) => s.includes('Builder Mode'));
      expect(builderMessage).toBeDefined();
      expect(builderMessage?.includes('Execution Phase')).toBe(true);
      expect(builderMessage?.includes('Prioritize implementation')).toBe(true);
      expect(builderMessage?.includes('targeted discovery only when blocked')).toBe(true);
      expect(builderMessage?.includes('Action:')).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('system-transform AGENTS.md warning', () => {
  test('AGENTS warning appears when both agentsMd and claudeMd are false', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: false,
        claudeMd: false
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasWarning = output.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(hasWarning).toBe(true);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('AGENTS warning does NOT appear when agentsMd is true', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasWarning = output.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(hasWarning).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('AGENTS warning does NOT appear when claudeMd is true (fallback)', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: false,
        claudeMd: true
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasWarning = output.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(hasWarning).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('AGENTS warning only shows for Setu agent', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: false,
        claudeMd: false
      });
      
      // Test Setu agent
      const setuHook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      const setuOutput = { system: [] as string[] };
      await setuHook({ sessionID: 'test' }, setuOutput);
      const setuHasWarning = setuOutput.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(setuHasWarning).toBe(true);
      
      // Test Explore agent
      const exploreHook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'explore',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      const exploreOutput = { system: [] as string[] };
      await exploreHook({ sessionID: 'test' }, exploreOutput);
      const exploreHasWarning = exploreOutput.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(exploreHasWarning).toBe(false);
      
      // Test General agent
      const generalHook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'general',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      const generalOutput = { system: [] as string[] };
      await generalHook({ sessionID: 'test' }, generalOutput);
      const generalHasWarning = generalOutput.system.some((s: string) => 
        s.includes('No AGENTS.md found')
      );
      expect(generalHasWarning).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('AGENTS warning is lower priority than gear messages', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: false,
        claudeMd: false
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,  // getContextCollector
        undefined,  // getProjectRules
        () => testDir  // getProjectDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      // Gear message should be at beginning (unshift)
      expect(output.system[0]?.includes('Scout Mode')).toBe(true);
      // AGENTS warning should appear somewhere in the output (contracts may come after)
      expect(output.system.some((s: string) => s.includes('No AGENTS.md found'))).toBe(true);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});

describe('system-transform contract injection', () => {
  test('Setu Scout gear includes research contract', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,
        undefined,
        () => testDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasResearchContract = output.system.some((s: string) => 
        s.includes('INTENT') && s.includes('TECHNICAL')
      );
      expect(hasResearchContract).toBe(true);
      
      const hasPlanContract = output.system.some((s: string) => 
        s.includes('WHY') && s.includes('FILES')
      );
      expect(hasPlanContract).toBe(false); // Scout doesn't get plan contract
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Setu Architect gear includes both research and plan contracts', async () => {
    const testDir = createTestDir('architect');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,
        undefined,
        () => testDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasResearchContract = output.system.some((s: string) => 
        s.includes('INTENT') && s.includes('TECHNICAL')
      );
      expect(hasResearchContract).toBe(true);
      
      const hasPlanContract = output.system.some((s: string) => 
        s.includes('WHY') && s.includes('FILES')
      );
      expect(hasPlanContract).toBe(true);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Setu Builder gear includes plan execution guidance', async () => {
    const testDir = createTestDir('builder');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'setu',
        undefined,
        undefined,
        () => testDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasPlanContract = output.system.some((s: string) => 
        s.includes('Execute PLAN.md') || (s.includes('WHY') && s.includes('FILES'))
      );
      expect(hasPlanContract).toBe(true);
      
      const hasResearchContract = output.system.some((s: string) => 
        s.includes('INTENT') && s.includes('TECHNICAL')
      );
      expect(hasResearchContract).toBe(false); // Builder doesn't get research contract
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Explore subagent does NOT get contract injection', async () => {
    const testDir = createTestDir('scout');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'explore',  // Subagent, not Setu
        undefined,
        undefined,
        () => testDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasResearchContract = output.system.some((s: string) => 
        s.includes('INTENT') && s.includes('TECHNICAL')
      );
      expect(hasResearchContract).toBe(false);
      
      const hasPlanContract = output.system.some((s: string) => 
        s.includes('WHY') && s.includes('FILES')
      );
      expect(hasPlanContract).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('General subagent does NOT get contract injection', async () => {
    const testDir = createTestDir('architect');
    
    try {
      const mockGetSetuFilesExist = (): FileAvailability => ({ 
        active: false, 
        context: false, 
        agentsMd: true,
        claudeMd: false 
      });
      
      const hook = createSystemTransformHook(
        () => ({ complete: false, stepsRun: new Set() }),
        mockGetSetuFilesExist,
        () => 'general',  // Subagent, not Setu
        undefined,
        undefined,
        () => testDir
      );
      
      const output = { system: [] as string[] };
      await hook({ sessionID: 'test' }, output);
      
      const hasResearchContract = output.system.some((s: string) => 
        s.includes('INTENT') && s.includes('TECHNICAL')
      );
      expect(hasResearchContract).toBe(false);
      
      const hasPlanContract = output.system.some((s: string) => 
        s.includes('WHY') && s.includes('FILES')
      );
      expect(hasPlanContract).toBe(false);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
