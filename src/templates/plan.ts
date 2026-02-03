export const PLAN_TEMPLATE = `# Plan

## Objective

<!-- One sentence: What this plan accomplishes -->
<!-- Example: "Add user authentication with JWT tokens and session management" -->

## Context Summary

<!-- 2-3 sentences from RESEARCH.md — just enough for subagents to understand -->
<!-- Don't copy entire RESEARCH.md — subagents can read it if needed -->

## Steps

<!-- 
CRITICAL: Each step must be atomic and self-contained.
Subagents receive ONLY their step via JIT context.
They don't see other steps. Make each step complete.

Format: Any of these work (LLM reads naturally):
  ## Step 1: Title
  ### Step 1: Title  
  **Step 1: Title**
-->

## Step 1: [Short Title]

**Objective:** What this step accomplishes (one sentence)

**Why:** Why this step is needed / what breaks without it

**Inputs:**
- What files/context this step needs to read
- What must exist before this step runs

**Actions:**
1. First action with exact detail
2. Second action with exact detail
3. Continue until step is complete

**Outputs:**
- What files are created/modified
- What state changes occur

**Verification:**
- How to verify this step succeeded
- Specific commands or checks

---

## Step 2: [Short Title]

<!-- Same structure as Step 1 -->
<!-- Include all context needed — subagent won't see Step 1 -->

---

<!-- Continue for all steps -->

## Success Criteria

<!-- How we know the ENTIRE plan is done (not just individual steps) -->

### Truths (Observable Behaviors)
- [ ] User can [do X]
- [ ] System [behaves Y way]

### Artifacts (Files That Must Exist)
- [ ] \`path/to/file.ts\` — provides [functionality]
- [ ] \`path/to/test.ts\` — tests [component]

### Key Links (Connections That Must Work)
- [ ] [Component A] calls [Component B] via [method]
- [ ] [Route] renders [Component] with [data]
`;
