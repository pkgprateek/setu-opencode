/**
 * Contract-driven quality guidance for Setu
 * 
 * Single source of truth for research and plan expectations.
 * Used in system prompts (full guidance) and tool descriptions (compact).
 */

export type Gear = 'scout' | 'architect' | 'builder';

/**
 * Full research guidance for system prompt injection
 * Provides detailed expectations with good/bad examples
 */
export const RESEARCH_SEMANTIC_REQUIREMENTS = `
Research must be comprehensive - minimize additional discovery for normal tasks:

1. INTENT & PRD - What we're building and why
2. TECHNICAL ANALYSIS - Stack evaluation, library choices, version quirks  
3. DESIGN CONSIDERATIONS - UX approach, component structure (when applicable)
4. ALTERNATIVES & TRADEOFFS - Options considered, why chosen approach wins
5. RISKS & FAILURE MODES - Known limitations, mitigation strategies
6. VERIFICATION STRATEGY - How to confirm this works
7. OPEN DECISIONS - Unresolved questions requiring user input (when applicable)
8. ASSUMPTIONS TO CONFIRM - Explicit assumptions that must be confirmed before execution
9. DX/UX & OPERABILITY IMPACT (when applicable) - How the solution affects user/developer flow, error clarity, and day-2 maintainability

Example GOOD:
"Building T4 Canvas image studio for AI generation...
Intent: Power-user interface for multiple AI models (Nano Banana Pro, Flux 2, GPT-image-1.5, Seedream)...
Technical: Vite + React + TypeScript + Tailwind chosen...
Tradeoffs: Rejected Next.js - no SSR needed, static export sufficient...
Risks: Tailwind v4 config differences, model API rate limits...
Assumptions to confirm: target scaffold path and package manager before initialization...
DX/UX impact: all visible controls are wired or explicitly marked non-interactive..."

Example BAD:
"Building a React app with auth. Will use JWT. Need login page."
(20 lines, no depth, no tradeoffs, no risks)
`;

/**
 * Full plan guidance for system prompt injection
 * Provides detailed expectations with good/bad examples
 */
export const PLAN_SEMANTIC_REQUIREMENTS = `
Plan must be atomically detailed - executable without interpretation:

Plan should include:
- OBJECTIVE - What outcome this plan delivers
- CONTEXT SUMMARY - Brief grounding from research
- GOALS / NON-GOALS - Scope boundaries
- ASSUMPTIONS / CONSTRAINTS - Environment, path, runtime, and policy constraints
- FILE-LEVEL EDIT LIST - Specific files or modules expected to change
- EXECUTION STEPS - Ordered phases/tasks that can be executed directly

Each unit of work in Execution Steps needs:
- WHY - Business or technical justification
- FILES - Specific paths being created/modified
- CHANGE INTENT - What the change accomplishes
- VERIFICATION - How to confirm it works
- DONE WHEN - Observable completion condition
- INTEGRATION IMPACT - How this connects with surrounding system (API/data/UI/CLI as applicable)
- EDGE CASES - What could go wrong (when applicable)

Completeness check (depends on project): include required wiring across interfaces, handlers, state/data flow, tests/docs, and operational readiness so the outcome feels complete.

Structure naturally (Phase > Task > Step or equivalent), focus on semantic completeness.

Example GOOD:
"Phase 1: Foundation
Task 1.1: Project Scaffold  
- Initialize Vite React TS project
  - Why: Dev server, HMR, production build out of box
  - Files: package.json, vite.config.ts, tsconfig.json
  - Verification: npm run dev starts on port 4000
  - Done When: app shell renders on expected port and route path
  - Integration Impact: routing, styling pipeline, and app entry are connected"

Example BAD:
"1) Setup project 2) Add auth 3) Build UI"
(flat list, no why, no verification, no files)
`;

/**
 * Compact research expectations for tool description
 * Reinforces quality at call-time without bloat
 */
export const RESEARCH_TOOL_EXPECTATIONS = `Create comprehensive RESEARCH.md covering intent/PRD, technical analysis with stack quirks, alternatives/tradeoffs, risks/failure modes, verification strategy, open decisions. Be exhaustive to minimize later discovery.`;

/**
 * Compact plan expectations for tool description
 * Reinforces quality at call-time without bloat
 */
export const PLAN_TOOL_EXPECTATIONS = `Create detailed PLAN.md with atomic steps including why, files touched, verification method. Structure naturally (Phase > Task > Step). Include rollback notes and success criteria. After .setu/PLAN.md is complete, provide user with plan preview and ask: Reply "go" to start, or tell me what to adjust.`;

/**
 * Reference example template - NOT enforced
 * Provided as guidance only, model may use any structure
 */
export const PLAN_EXAMPLE_TEMPLATE = `# Plan

## Objective
[What this plan accomplishes]

## Context Summary
[2-3 sentences from RESEARCH.md]

## Non-goals
[What is out of scope]

## Assumptions / Constraints
[Stack, runtime, constraints]

## File-level Edit List
- [file path 1]
- [file path 2]

## Execution Steps
# Phase 1: [Phase Name]
## Task 1.1: [Task Name]
- Step 1: [Atomic action]
  - Why: [Justification]
  - Files: [Specific paths]
  - Verification: [How to confirm]

## Expected Output
[What success looks like]

## Rollback Note
[How to revert]

## Acceptance Tests
- [Test 1]
- [Test 2]

## Verify Protocol
build -> lint -> test
`;

/**
 * Get research contract appropriate for current gear
 * Scout: Full guidance (need to research)
 * Architect: Full guidance + action prompt (create research now)
 * Builder: Empty (already have research, time to plan/execute)
 */
export function getResearchContractForSystem(gear: Gear): string {
  if (gear === 'scout') {
    return RESEARCH_SEMANTIC_REQUIREMENTS;
  }
  if (gear === 'architect') {
    return RESEARCH_SEMANTIC_REQUIREMENTS + '\n\nCreate comprehensive research artifact now.';
  }
  return '';
}

/**
 * Get plan contract appropriate for current gear
 * Architect: Full guidance + action prompt (create plan now)
 * Builder: Execution guidance (follow plan with fidelity)
 * Scout: Empty (can't plan yet, need research first)
 */
export function getPlanContractForSystem(gear: Gear): string {
  if (gear === 'architect') {
    return PLAN_SEMANTIC_REQUIREMENTS + '\n\nCreate atomic plan artifact now.';
  }
  if (gear === 'builder') {
    return 'Execute PLAN.md with fidelity. Verify each step before proceeding.';
  }
  return '';
}
