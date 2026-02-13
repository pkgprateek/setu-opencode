# AGENTS.md - Setu Project Guide

> **Project**: setu-opencode  
> **Purpose**: Disciplined RPI (Research → Plan → Implement) workflow enforcement  
> **Philosophy**: "One Discipline. Zero Styles. Infinite Clarity."

---

## Quick Start for AI Agents

### Understanding Setu

Setu is a **discipline layer**, not a coding tool. It enforces the RPI workflow:

1. **Research** (Scout gear) - Understand before building
2. **Plan** (Architect gear) - Design before coding  
3. **Implement** (Builder gear) - Build with verification

This prevents "AI slop" - code that looks right but is wrong.

### Three Modes, One Purpose Each

| Mode | How to Access | Purpose | Enforcement |
|------|---------------|---------|-------------|
| **Setu** | Press Tab | Disciplined RPI workflow | Full (gears, verification, safety) |
| **Plan** | Press Tab | Free exploration | None (research mode) |
| **Build** | Press Tab | Quick execution | Minimal (safety only) |

**Key insight**: Setu doesn't compete with Plan/Build - it complements them. Use:
- **Build** for quick fixes (typos, small changes)
- **Plan** for exploration (understanding codebase)
- **Setu** for substantial work (features, refactoring)

---

## The Gear System

### Automatic Workflow Enforcement

Gears shift **automatically** based on artifact existence:

```
Session Start
    │
    ▼
No RESEARCH.md? → SCOUT gear
    │              • Read-only
    │              • Research only
    │              • Cannot write code
    ▼
Create RESEARCH.md
    │
    ▼
RESEARCH.md exists, no PLAN.md? → ARCHITECT gear
    │                                 • Can write to .setu/
    │                                 • Can create PLAN.md
    │                                 • Cannot touch source code
    ▼
Create PLAN.md
    │
    ▼
PLAN.md exists → BUILDER gear
                   • Full access
                   • Verify before "done"
```

### Gear Capabilities

| Gear | Can Read | Can Write .setu/ | Can Write src/ | How to Advance |
|------|----------|------------------|----------------|----------------|
| **Scout** | ✅ All | ✅ RESEARCH.md only | ❌ No | `setu_research` |
| **Architect** | ✅ All | ✅ Any file | ❌ No | `setu_plan` |
| **Builder** | ✅ All | ✅ Any | ✅ Yes | N/A (final) |

### Why Gears Matter

From Dex Horthy's research ("No Vibes Allowed"):
- AI produces "slop" without understanding
- Context rot degrades quality beyond ~10k tokens
- RPI workflow prevents wrong assumptions and architectural debt

Setu enforces this **physically** via hooks - cannot be bypassed.

---

## Tool Reference

### Core Tools

#### `setu_context` - Session Management

Manage your session, task, and constraints.

```typescript
setu_context({
  action: 'confirm' | 'create_task' | 'update_task' | 'clear_task' | 'reset_progress',
  summary?: string,      // For 'confirm': What you understand
  task?: string,         // For 'create_task' | 'update_task'
  constraints?: string[] // e.g., ['READ_ONLY', 'NO_DELETE']
});
```

**Examples**:
```typescript
// Confirm understanding
setu_context({
  action: 'confirm',
  summary: 'This is a TypeScript React app using Vite. Auth is in src/auth/.'
});

// Create task
setu_context({
  action: 'create_task',
  task: 'Implement JWT authentication',
  constraints: ['use_existing_patterns', 'add_tests']
});
```

---

#### `setu_task` - Task Management

Create, update, or clear active tasks. Archives old artifacts on new task creation.

```typescript
setu_task({
  action: 'create' | 'update' | 'clear',
  task?: string,         // For 'create': task description
  constraints?: string[] // e.g., ['READ_ONLY', 'NO_DELETE']
});
```

**On `create`**:
1. Archives existing RESEARCH.md and PLAN.md to `.setu/HISTORY.md`
2. Deletes the original files (gear resets to scout)
3. Creates new active task

**Example**:
```typescript
setu_task({
  action: 'create',
  task: 'Implement dark mode toggle',
  constraints: ['use_existing_patterns']
});
// Result: Old artifacts archived, gear reset to scout
```

---

#### `setu_research` - Parallel Research

Research with multiple subagents working in parallel.

```typescript
setu_research({
  task: string,           // What to research
  focus?: string[],       // Specific areas: ['security', 'patterns', 'testing']
  openQuestions?: string[] // Unresolved questions requiring user input
});
```

**What happens**:
1. Spawns 3 parallel subagents
2. Each researches different aspect
3. Results merged into RESEARCH.md
4. If openQuestions provided, triggers question blocking (user must answer)
5. Gear advances: Scout → Architect

**Example**:
```typescript
setu_research({
  task: 'Implement authentication system',
  focus: ['security', 'patterns']
});

// Result: RESEARCH.md created, now in Architect gear
```

---

#### `setu_plan` - Create Implementation Plan

Create PLAN.md with implementation steps.

```typescript
setu_plan({
  objective: string,        // One sentence: what this plan accomplishes
  contextSummary?: string,  // 2-3 sentences from RESEARCH.md for subagent context
  steps: string             // Full step definitions in markdown (Phase > Task > Step hierarchy)
});
```

**What happens**:
1. Validates RESEARCH.md exists (precondition)
2. Normalizes and counts steps (max 100)
3. Writes PLAN.md to `.setu/`
4. Resets step progress to 0
5. Triggers user approval (question blocking)
6. Gear advances: Architect → Builder (after approval)

**Example** (hierarchical Phase > Task > Step format):
```typescript
setu_plan({
  objective: 'Implement JWT authentication',
  contextSummary: 'Uses jose library. Existing middleware pattern in src/middleware/.',
  steps: `# Phase 1: Setup
## Task 1.1: Install dependencies
- Step 1: Add jose library
  - Why: Need JWT signing/verification
  - Edit(s): package.json
  - Commands: npm install jose

## Task 1.2: Configure environment
- Step 1: Add JWT secret config
  - Why: Auth requires secret key
  - Edit(s): .env.example, src/config/auth.ts
  - Commands: None

# Phase 2: Implementation
## Task 2.1: Create middleware
- Step 1: Implement JWT validation
  - Why: Protect routes from unauthorized access
  - Edit(s): src/middleware/auth.ts
  - Commands: bun test src/middleware`,
  nonGoals: 'No refresh token logic, no OAuth integration',
  assumptions: 'Node 20+, existing Express setup',
  fileEdits: '- package.json\n- .env.example\n- src/config/auth.ts\n- src/middleware/auth.ts',
  expectedOutput: 'All protected routes return 401 without valid JWT',
  rollbackNote: 'Revert commits and remove jose dependency',
  acceptanceTests: '- Valid JWT allows access\n- Invalid JWT returns 401\n- Missing JWT returns 401',
  verifyProtocol: 'build -> lint -> test'
});

// Result: PLAN.md created with hierarchical structure, user approval required, then Builder gear
```

---

#### `setu_verify` - Run Verification

Run build, test, and lint verification.

```typescript
setu_verify({
  steps?: string[],      // Specific steps to run: 'build', 'test', 'lint', 'typecheck', 'visual'
  skipSteps?: string[]   // Steps to skip
});
```

**Default behavior** (no args): Runs all required steps (build, test, lint). Typecheck runs if available. Visual checks are not run automatically — the user is prompted to verify UI manually after other steps pass.

**Example**:
```typescript
setu_verify({ steps: ['build', 'test'] });
// Result: Build and test checks run, recorded in verification.log

setu_verify({ skipSteps: ['lint'] });
// Result: All steps except lint
```

---

#### `setu_doctor` - Environment Check

Check environment health and detect issues.

```typescript
setu_doctor({
  verbose?: boolean  // Include healthy checks in output, not just issues (default: false)
});
```

**Checks**:
- Git status (uncommitted changes, detached HEAD)
- Dependencies (missing node_modules, lockfile sync)
- Runtime (Node.js version, TypeScript availability)
- Dev server conflicts (would break build)

**Example**:
```typescript
setu_doctor({ verbose: true });
// Result: Full report including healthy checks, warnings, and errors
```

---

## Working with Setu

### Typical Workflow

**Starting a new feature**:
```
User: Implement dark mode toggle
Setu: [Scout gear] Let me research the current theming approach...
Setu: Reading src/theme/, src/components/...
Setu: setu_research({ task: 'Implement dark mode toggle' })
Setu: [Spawning 3 research subagents...]
Setu: Created RESEARCH.md. Advanced to Architect gear.
Setu: [Architect gear] Creating implementation plan...
Setu: setu_plan({ objective: 'Implement dark mode toggle', steps: '## Step 1: ...' })
Setu: Created PLAN.md. User approval required, then Builder gear.
Setu: [Builder gear] Executing step 1/4...
Setu: [Step 1 complete] setu_verify() → All passed
Setu: [Step 2 complete] setu_verify() → All passed
Setu: Feature complete. All 4 steps verified.
```

**Quick fix (wrong mode?)**:
```
User: Fix typo in README
Setu: [Scout gear] This is a simple fix. For immediate execution, press Tab to switch to Build mode.
User: [Presses Tab → Build mode]
Build: Fixed typo.
```

---

### Best Practices

#### 1. Let Setu Research First

**Don't**: Jump straight to implementation in Scout gear  
**Do**: Call `setu_research` to advance to Architect

**Why**: Prevents wrong assumptions. Research phase compresses "truth" about the codebase.

#### 2. Create Clear Plans

**Don't**: Vague plans ("fix the bug")  
**Do**: Specific steps ("Step 1: Add validation, Step 2: Update error handling...")

**Why**: Clear plans are verifiable. Vague plans lead to "slop."

#### 3. Verify Before Claiming Done

**Don't**: "Done!" without verification  
**Do**: `setu_verify()` after significant changes

**Why**: Catch issues before user discovers them.

#### 4. Use Parallel Execution

**Don't**: Serial tool calls  
**Do**: Parallel reads when possible

```typescript
// GOOD: Parallel
read("src/auth/index.ts")
read("src/auth/types.ts")
read("package.json")

// BAD: Serial
read("src/auth/index.ts")
// wait
read("src/auth/types.ts")
// wait
read("package.json")
```

**Why**: Faster context gathering. More tokens for actual work.

#### 5. Respect Environment

**Don't**: Run `npm run build` while dev server is active  
**Do**: Check with `setu_doctor` first, or stop dev server

**Why**: Prevents breaking local environment (Theo problem).

---

## Architecture Overview

### Three Layers

```
┌─────────────────────────────────────┐
│  Layer 3: Tools (User Interface)    │
│  - setu_context                     │
│  - setu_research                    │
│  - setu_plan                        │
│  - setu_verify                      │
│  - setu_doctor                      │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  Layer 2: Gears (Workflow Engine)   │
│  - Scout (Research)                 │
│  - Architect (Plan)                 │
│  - Builder (Implement)              │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  Layer 1: Hooks (Enforcement)       │
│  - tool.execute.before (blocks)     │
│  - system.transform (injects)       │
│  - chat.message (tracks)            │
└─────────────────────────────────────┘
```

### Key Files

```
src/
├── index.ts              # Plugin entry, hook registration
├── agent/
│   └── setu-agent.ts     # Agent persona
├── hooks/
│   ├── chat-message.ts   # Agent tracking
│   ├── system-transform.ts # Context injection (gear-based)
│   └── tool-execute.ts   # Enforcement (core moat)
├── enforcement/
│   ├── gears.ts          # Gear state machine (single workflow authority)
│   └── attempts.ts       # Ghost loop prevention
├── context/
│   ├── storage.ts        # Read/write .setu/
│   ├── active.ts         # Task management
│   ├── setu-state.ts     # Discipline guards (question/safety/overwrite)
│   └── cleanse.ts        # JIT context
├── tools/
│   ├── setu-context.ts   # Session management
│   ├── setu-task.ts      # Task creation with artifact archiving
│   ├── setu-research.ts  # Parallel research (with open questions)
│   ├── setu-plan.ts      # Plan creation (with user approval)
│   ├── setu-verify.ts    # Verification
│   └── setu-doctor.ts    # Environment checks
└── environment/
    └── detector.ts       # Environment awareness
```

---

## Context Management

### JIT (Just-In-Time) Loading

**Problem**: Context stuffing degrades quality beyond ~10k tokens (Jack Morris research)  
**Solution**: Load only what you need, when you need it

**How it works**:
1. **System prompt**: Current gear, task status, constraints
2. **Subagent spawn**: Fresh JIT-cleansed context
3. **Tool execution**: Relevant files only

**Results Pattern**:
- Track progress via file existence (survives compaction)
- Git-tracked (reviewable)
- Survives session restarts

### Context Files

```
.setu/
├── context.json          # Machine-parseable context
├── active.json           # Current task, constraints
├── RESEARCH.md           # Research findings
├── PLAN.md               # Implementation plan
├── HISTORY.md            # Archived artifacts from previous tasks
├── verification.log      # Audit trail
└── feedback.md           # User feedback
```

---

## Safety & Security

### Path Validation

All file operations validated:
- No path traversal (../../etc/passwd)
- No absolute paths outside project
- Sensitive file detection (.env, .key)

### Environment Checks

Before destructive operations:
- Dev server detection
- Build process detection
- Git status check

### Secret Detection

Scans for:
- API keys
- Passwords
- Private keys
- Tokens

---

## Comparison: Setu vs Others

| Feature | Setu | beads | GSD | BMAD |
|---------|------|-------|-----|------|
| **Enforcement** | ✅ Physical (hooks) | ❌ Prompt only | ❌ Prompt only | ❌ Prompt only |
| **RPI Workflow** | ✅ Automatic (gears) | ❌ Manual | ✅ Semi-auto | ✅ Complex |
| **Parallel Execution** | ✅ (subagents) | ❌ Sequential | ✅ (waves) | ✅ (agents) |
| **Setup** | ✅ One line | ⚠️ CLI install | ❌ 40+ files | ❌ Complex |
| **Complexity** | 🟢 Low | 🟡 Medium | 🔴 High | 🔴 Very High |
| **Context Management** | ✅ JIT | ⚠️ Git-backed | ✅ Fresh agents | ❌ Database |

**Setu's unique advantage**: The only system that **physically enforces** RPI workflow through hooks. Cannot be bypassed.

---

## Target Personas

| Persona | Pain Point | Setu Solution |
|---------|------------|---------------|
| **Junior Dev** | "AI does random stuff" | Enforced workflow prevents mistakes |
| **Senior Dev** | "Spend time fixing AI" | Quality gate before completion |
| **Tech Lead** | "Unpredictable behavior" | Consistent, auditable workflow |
| **Startup Founder** | "Burn tokens on wrong approaches" | Research phase prevents waste |
| **Solo Builder** | "AI loses context" | Persistence across sessions |

---

## Commands

### Build
```bash
bun run build
```

### Development
```bash
bun run dev  # Watch mode
```

### Quality
```bash
bun run lint       # Linting
bun run typecheck  # Type checking
```

### Testing
```bash
cd tests
opencode  # Load plugin from dist/
```

---

## Contributing

### Code Style
- `camelCase` for variables/functions
- `PascalCase` for types/interfaces
- Explicit return types on exports
- Prefer `const` over `let`

### Commit Messages
```
type(scope): summary

Context in 1-2 sentences.
Key detail if non-obvious.
```

**Types**: `feat:`, `fix:`, `docs:`, `refactor:`

---

## Resources

- **Architecture**: docs/internal/ARCHITECTURE.md
- **Research**: docs/internal/RESEARCH.md
- **Simplification Plan**: docs/internal/SIMPLIFY.md
- **OpenCode Docs**: https://opencode.ai/docs

---

## License

Apache 2.0 - See LICENSE file
