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

#### `setu_research` - Parallel Research

Research with multiple subagents working in parallel.

```typescript
setu_research({
  task: string,           // What to research
  focus?: string[]        // Specific areas: ['security', 'patterns', 'testing']
});
```

**What happens**:
1. Spawns 3 parallel subagents
2. Each researches different aspect
3. Results merged into RESEARCH.md
4. Gear advances: Scout → Architect

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
  task: string,           // What to implement
  findings?: string,      // Key findings from research
  steps?: string[]        // Optional: predefined steps
});
```

**What happens**:
1. Analyzes findings
2. Creates implementation plan
3. Spawns reviewer subagent to validate
4. Writes PLAN.md
5. Gear advances: Architect → Builder

**Example**:
```typescript
setu_plan({
  task: 'Implement JWT authentication',
  findings: 'Use jose library, existing middleware pattern in src/middleware/'
});

// Result: PLAN.md created, now in Builder gear
```

---

#### `setu_verify` - Run Verification

Run build, test, and lint verification.

```typescript
setu_verify({
  scope?: 'full' | 'incremental'  // Default: 'full'
});
```

**Always runs**:
1. Build check
2. Test check  
3. Lint check

**Example**:
```typescript
setu_verify({ scope: 'full' });
// Result: All checks passed, recorded in verification.log
```

---

#### `setu_doctor` - Environment Check

Check environment health and detect issues.

```typescript
setu_doctor({
  check?: 'all' | 'environment' | 'git' | 'dependencies'
});
```

**Checks**:
- Dev server running (would break build)
- Uncommitted changes
- Missing dependencies
- Configuration issues

**Example**:
```typescript
setu_doctor({ check: 'all' });
// Result: Warnings about dev server on port 3000
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
Setu: setu_plan({ task: 'Implement dark mode toggle', findings: '...' })
Setu: Created PLAN.md with 4 steps. Advanced to Builder gear.
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
│   ├── system-transform.ts # Context injection
│   └── tool-execute.ts   # Enforcement (core moat)
├── enforcement/
│   ├── gears.ts          # Gear state machine
│   └── attempts.ts       # Ghost loop prevention
├── context/
│   ├── storage.ts        # Read/write .setu/
│   ├── active.ts         # Task management
│   └── cleanse.ts        # JIT context
├── tools/
│   ├── setu-context.ts   # Session management
│   ├── setu-research.ts  # Parallel research
│   ├── setu-plan.ts      # Plan creation
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
