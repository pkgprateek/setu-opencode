import { describe, expect, test } from 'bun:test';
import {
  RESEARCH_SEMANTIC_REQUIREMENTS,
  PLAN_SEMANTIC_REQUIREMENTS,
  RESEARCH_TOOL_EXPECTATIONS,
  PLAN_TOOL_EXPECTATIONS,
  PLAN_EXAMPLE_TEMPLATE,
  getResearchContractForSystem,
  getPlanContractForSystem,
} from '../contracts';

describe('contracts', () => {
  describe('exports exist', () => {
    test('should export research semantic requirements', () => {
      expect(RESEARCH_SEMANTIC_REQUIREMENTS).toBeDefined();
      expect(typeof RESEARCH_SEMANTIC_REQUIREMENTS).toBe('string');
    });

    test('should export plan semantic requirements', () => {
      expect(PLAN_SEMANTIC_REQUIREMENTS).toBeDefined();
      expect(typeof PLAN_SEMANTIC_REQUIREMENTS).toBe('string');
    });

    test('should export research tool expectations', () => {
      expect(RESEARCH_TOOL_EXPECTATIONS).toBeDefined();
      expect(typeof RESEARCH_TOOL_EXPECTATIONS).toBe('string');
    });

    test('should export plan tool expectations', () => {
      expect(PLAN_TOOL_EXPECTATIONS).toBeDefined();
      expect(typeof PLAN_TOOL_EXPECTATIONS).toBe('string');
    });

    test('should export plan example template', () => {
      expect(PLAN_EXAMPLE_TEMPLATE).toBeDefined();
      expect(typeof PLAN_EXAMPLE_TEMPLATE).toBe('string');
    });

    test('should export gear helpers', () => {
      expect(getResearchContractForSystem).toBeDefined();
      expect(typeof getResearchContractForSystem).toBe('function');
      expect(getPlanContractForSystem).toBeDefined();
      expect(typeof getPlanContractForSystem).toBe('function');
    });
  });

  describe('research semantic requirements', () => {
    test('should contain key research elements', () => {
      const content = RESEARCH_SEMANTIC_REQUIREMENTS;
      expect(content).toContain('INTENT');
      expect(content).toContain('TECHNICAL');
      expect(content).toContain('ALTERNATIVES');
      expect(content).toContain('TRADEOFFS');
      expect(content).toContain('RISKS');
      expect(content).toContain('VERIFICATION');
      expect(content).toContain('Example GOOD');
      expect(content).toContain('Example BAD');
    });
  });

  describe('plan semantic requirements', () => {
    test('should contain key plan elements', () => {
      const content = PLAN_SEMANTIC_REQUIREMENTS;
      expect(content).toContain('WHY');
      expect(content).toContain('FILES');
      expect(content).toContain('CHANGE INTENT');
      expect(content).toContain('VERIFICATION');
      expect(content).toContain('Example GOOD');
      expect(content).toContain('Example BAD');
    });
  });

  describe('research tool expectations', () => {
    test('should be compact without examples', () => {
      const content = RESEARCH_TOOL_EXPECTATIONS;
      expect(content.length).toBeLessThan(500);
      expect(content).toContain('intent');
      expect(content).toContain('technical');
      expect(content).toContain('tradeoffs');
      expect(content).toContain('risks');
    });
  });

  describe('plan tool expectations', () => {
    test('should be compact without examples', () => {
      const content = PLAN_TOOL_EXPECTATIONS;
      expect(content.length).toBeLessThan(500);
      expect(content).toContain('atomic');
      expect(content).toContain('why');
      expect(content).toContain('files');
      expect(content).toContain('verification');
    });
  });

  describe('getResearchContractForSystem', () => {
    test('should return full guidance for scout', () => {
      const contract = getResearchContractForSystem('scout');
      expect(contract).toContain('INTENT');
      expect(contract).toContain('TECHNICAL');
      expect(contract).not.toContain('Create comprehensive');
    });

    test('should return full guidance plus action for architect', () => {
      const contract = getResearchContractForSystem('architect');
      expect(contract).toContain('INTENT');
      expect(contract).toContain('TECHNICAL');
      expect(contract).toContain('Create comprehensive research artifact now');
    });

    test('should return empty for builder', () => {
      const contract = getResearchContractForSystem('builder');
      expect(contract).toBe('');
    });
  });

  describe('getPlanContractForSystem', () => {
    test('should return empty for scout', () => {
      const contract = getPlanContractForSystem('scout');
      expect(contract).toBe('');
    });

    test('should return full guidance plus action for architect', () => {
      const contract = getPlanContractForSystem('architect');
      expect(contract).toContain('WHY');
      expect(contract).toContain('FILES');
      expect(contract).toContain('Create atomic plan artifact now');
    });

    test('should return execution guidance for builder', () => {
      const contract = getPlanContractForSystem('builder');
      expect(contract).toContain('Execute PLAN.md');
      expect(contract).toContain('Verify each step');
    });
  });
});
