---
name: setu-bootstrap
description: Initialize Setu for a new project. Discovers project structure, creates AGENTS.md and skills. Use when starting work on a new codebase, asked to "set up", "initialize", or "bootstrap" a project.
---

# Bootstrap Protocol

On first run in any project, establish the foundation.

## Step 0: Initial Acknowledgment

When starting work on a new project:

0. **Check for existing context**: If `.setu/active.json` exists with `status: "in_progress"`, ask: "Last session you were working on [task]. Would you like to continue, or start something new?"
1. **Acknowledge** the project briefly
2. **Ask before proceeding**: "Before I begin, is there any additional context, specific focus, or details you'd like to share?"
3. **Wait for response** — do not proceed until user responds
4. **Incorporate context** from user's response into all subsequent phases
5. **Save to active.json** — Record the task, mode, and any constraints mentioned

*This ensures no tokens are wasted on analysis that misses critical context.*

## Step 1: Discovery

Perform exploration to understand the project:

**Detection logic:**
1. Search upward from current directory to find:
   - Git root (`.git/` directory)
   - Project markers (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.)
2. If multiple potential roots exist (monorepo with nested projects), ask which to use
3. Check the identified project root for existing infrastructure

**Check for:**
- Existing `.setu/` directory (previous Setu context)
- Existing rules files (`AGENTS.md`, `CLAUDE.md`) in project root
- Existing skills in `.opencode/skills/` or `.claude/skills/`
- Codebase structure (technology stack, architecture patterns, conventions)

## Step 1.5: Setu Context Initialization

If `.setu/` directory doesn't exist, create it:

```
.setu/
├── context.json    # Machine-parseable (for injection)
├── active.json     # Current task, mode, constraints
└── verification.log  # Audit trail
```

If `.setu/context.json` exists, load it and verify it's still accurate.

## Step 2: Infrastructure Initialization

Handle all five scenarios (checked in order — first match wins):

### Scenario A: Empty or New Project
1. Detect: Project root exists but contains no meaningful codebase (no source files, only boilerplate like `.git/`, `README.md`, or `LICENSE`)
2. Notify: "This appears to be a new project with no existing codebase."
3. Proceed to Phase 2.5 (Project Inception)

### Scenario B: Neither rules file nor skills exist
1. Notify: "No project rules file or skills detected."
2. Ask: "Should I analyze the codebase and initialize both?"
3. If approved, create both `AGENTS.md` and `.opencode/skills/project-patterns/`

### Scenario C: Rules file exists, but no skills directory
1. Notify: "Found `AGENTS.md` but no `.opencode/skills/` directory."
2. Ask: "Should I create project-specific skills based on the codebase?"
3. If approved, create `.opencode/skills/project-patterns/` adapted to visible patterns

### Scenario D: Skills exist, but no rules file
1. Notify: "Found `.opencode/skills/` but no `AGENTS.md`."
2. Ask: "Should I create `AGENTS.md` with project conventions?"
3. If approved, analyze codebase and create `AGENTS.md`

### Scenario E: Both exist
1. Read and apply existing rules and skills
2. Proceed with the task

### Scenario F: .setu/ exists (Previous Setu Context)
1. Load `.setu/context.json` for project understanding
2. Check `.setu/active.json` for in-progress task
3. If active task exists, ask: "Continue with [task] or start something new?"
4. Proceed with task, leveraging existing context

## Step 2.5: Project Inception (For New Projects Only)

When Scenario A is triggered and user has provided project vision:

1. **Understand the Vision**
   - Listen to the idea, features, and behavioral requirements
   - Ask clarifying questions only if critical details are missing (tech preferences, deployment target, scale expectations)

2. **Propose the Foundation** (brief, not exhaustive)
   - Recommended tech stack with rationale
   - High-level architecture (2-3 sentences)
   - Directory structure overview
   - Key patterns that will be used

3. **Await Approval**
   - Present the proposal concisely
   - Ask: "Does this direction align with your vision? Any adjustments before I scaffold?"

4. **Scaffold & Initialize**
   - Create project structure
   - Initialize with recommended tooling
   - Create `AGENTS.md` capturing the decisions made
   - Create initial `.opencode/skills/project-patterns/` if patterns are established
   - Commit with: `feat: initial project scaffold`

## Step 3: Rules File Creation

Load the `setu-rules-creation` skill for detailed guidance on creating AGENTS.md.

## Step 4: Project Skills Creation

Create `.opencode/skills/project-patterns/SKILL.md` with:
- Directory structure documentation
- Component/module patterns observed
- State management approach
- API patterns specific to this project

## Quick Reference

```
Bootstrap Flow:
┌─────────────────┐
│ Step 0: Ask     │ ← Check active.json, "Any additional context?"
└────────┬────────┘
         ▼
┌─────────────────┐
│ Step 1: Detect  │ ← Find project root, check existing setup
└────────┬────────┘
         ▼
┌─────────────────┐
│ Step 1.5: Setu  │ ← Create/load .setu/ directory
└────────┬────────┘
         ▼
┌─────────────────┐
│ Step 2: Init    │ ← Scenario A/B/C/D/E/F
└────────┬────────┘
         ▼
┌─────────────────┐
│ Step 3: Rules   │ ← Create AGENTS.md if approved
└────────┬────────┘
         ▼
┌─────────────────┐
│ Step 4: Skills  │ ← Create project skills if approved
└─────────────────┘
```
