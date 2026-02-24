# Security Policy

Setu is a safety-first OpenCode plugin. This file describes what we currently protect against, where protections live, and where limits still exist.

## Threat Model (Current)

Setu is designed to reduce the blast radius of agent mistakes and unsafe tool usage. Current protections focus on:

- secrets leakage through write/edit operations
- path traversal and sensitive file access attempts
- destructive or high-risk commands without explicit user approval

These controls are strong guardrails, not a full sandbox.

## What We Defend Against

### 1) Secret Writes (best-effort prevention)

- Goal: prevent accidental commits/writes of credentials and tokens.
- How: content inspection in tool-execution guard before write/edit is allowed.
- Behavior: blocks critical/high-confidence secret patterns and logs security events.

Relevant runtime surfaces:

- `src/hooks/tool-execute.ts`
- `src/security/*`

### 2) Path Traversal and Sensitive File Writes

- Goal: prevent writes outside project boundaries or to sensitive targets.
- How: normalized path validation before mutating file operations.
- Behavior: blocks invalid/sensitive paths and records audit events.

Relevant runtime surfaces:

- `src/hooks/tool-execute.ts`
- `src/security/path-validation.ts`

### 3) Destructive Commands and Risky Actions

- Goal: require explicit user intent for dangerous operations.
- How: hard-safety classifier + confirmation flow + pending decision state.
- Behavior:
  - blocks clearly unsafe actions, or
  - pauses execution and asks for explicit approval.

Relevant runtime surfaces:

- `src/hooks/tool-execute.ts`
- `src/security/safety-classifier.ts`
- `src/context/setu-state.ts`

### 4) Pre-Execution Context Gating (Hydration)

- Goal: avoid premature side effects before context is understood.
- How: allow read-only exploration first; block side-effect tools until context is confirmed.
- Behavior: fail-closed for unknown tools during hydration path.

Relevant runtime surfaces:

- `src/enforcement/hydration.ts`
- `src/hooks/tool-execute.ts`

## Auditability

Setu records security-relevant events to `.setu/security.log` for local forensic traceability.

Relevant runtime surface:

- `src/security/audit-log.ts`

## Known Limitations

- Setu is not a kernel/container sandbox.
- Secret detection is pattern-based and can have false negatives/positives.
- Safety checks reduce risk but cannot model every environment-specific hazard.
- Plugin misconfiguration (duplicate/old runtime wiring) can still cause confusing behavior.

## Reporting a Vulnerability

Please do not open public issues for sensitive disclosures.

- Preferred: GitHub Security Advisories (private report)
  - `https://github.com/pkgprateek/setu-opencode/security/advisories/new`
- If unavailable, open a minimal issue without exploit details and request a private channel.

When reporting, include:

- affected version/commit
- reproduction steps
- expected vs actual behavior
- potential impact

## Security Update Process

- Fixes are validated with tests (`bun test`), lint (`bun run lint`), and typecheck (`bun run typecheck`).
- Security-relevant behavior changes should include both tests and changelog notes.
