---
name: setu-verification
description: Run verification protocol before completing tasks. Checks build, tests, lint. Use when finishing a task, before claiming completion, or asked to "verify", "validate", "check", "test", or "run tests".
---

# Verification Protocol

Before declaring a task complete, verify using targeted extraction.

## When to Verify

Verification runs in **Builder gear** (after research and planning are complete).

- **Full scope** (default): All steps — build, test, lint, type check
- **Incremental scope**: Only steps relevant to changed files

## Verification Steps

### 1. Build Check

```bash
# Adapt to detected build tool (npm/yarn/pnpm/bun/cargo/go)
<build-command> || (<build-command> 2>&1 | tail -30)
```

- Check exit code first
- If failed, capture only last 30 lines or grep for "error"
- The `setu_verify` tool auto-detects and generates correct commands

### 2. Test Check

```bash
# Adapt to detected test runner
<test-command> 2>&1 | grep -A 3 "FAIL\|Error\|✗" | head -30
```

- Capture only failures, not full test output
- Look for patterns: `FAIL`, `Error`, `✗`, `failed`
- The `setu_verify` tool auto-detects vitest/jest/pytest/etc.

### 3. Lint Check

```bash
# Adapt to detected linter
<lint-command> 2>&1 | grep -E "error|warning" | head -20
```

- Capture errors/warnings count or first few issues
- The `setu_verify` tool auto-detects eslint/biome/ruff/clippy/etc.

### 4. Type Check (if applicable)

```bash
# For TypeScript projects
<typecheck-command> 2>&1 | head -30
```

- For TypeScript projects
- Capture type errors only
- The `setu_verify` tool generates this for TS/Flow projects only

### 5. Visual Check

```
Defer to user: "Please verify the UI looks correct."
```

- Agent typically lacks screenshot access
- Ask user to confirm visual correctness
- Note any expected visual changes

### 6. Edge Cases

- Note which edge cases were considered
- Test critical ones only
- Document assumptions made

## Principle

**Extract only what's needed.** 

One root error often causes many downstream failures — find the root, ignore the noise.

## Quick Commands by Stack

### Node.js / TypeScript
```bash
npm run build && npm test && npm run lint
```

### Python
```bash
python -m pytest && python -m ruff check .
```

### Go
```bash
go build ./... && go test ./... && golangci-lint run
```

### Rust
```bash
cargo build && cargo test && cargo clippy
```

## Targeted Extraction Examples

**Build failed - get useful info:**
```bash
npm run build 2>&1 | tail -30
```

**Tests failed - get failures only:**
```bash
npm test 2>&1 | grep -B 2 -A 5 "FAIL\|Error" | head -50
```

**Many lint errors - get count and samples:**
```bash
npm run lint 2>&1 | grep -c "error" && npm run lint 2>&1 | grep "error" | head -10
```

## When to Skip Verification

Skip verification for:
- Comment changes only
- Documentation updates
- Whitespace/formatting fixes
- Renaming variables (after LSP rename)

Always verify for:
- New dependencies added
- Configuration changes
- Any logic changes

## Verification Logging

After each verification cycle, append results to `.setu/verification.log`:

```markdown
## [2025-01-24T10:30:00Z] - Task: Implement context persistence

### Build
- **Status:** PASS
- **Command:** `bun run build`
- **Output:** Bundled 92 modules in 23ms

### Test  
- **Status:** SKIP (no tests configured)

### Lint
- **Status:** PASS
- **Command:** `bun run lint`

### Type Check
- **Status:** PASS
- **Command:** `bun run typecheck`
```

This provides an audit trail and helps debug issues that appear later.

## Update Active Task on Completion

After successful verification:
1. Update `.setu/active.json` with `status: "completed"`
2. Clear or archive the active task
3. The task is now safe to commit
