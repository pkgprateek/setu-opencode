# Setu Context

> Last updated: 2025-01-24
> Confirmed: Yes

## Summary

setu-opencode is an OpenCode plugin that provides Setu as a disciplined primary agent. It enforces pre-emptive discipline: context first, verify always. The plugin implements Phase 0 blocking, context persistence, mode-aware enforcement, and feedback mechanisms.

## Current Task

PR preparation, review implementation, end-to-end testing, documentation

## Plan

1. Create PR title/summary
2. Review existing implementation
3. End-to-end testing in ./tests/
4. Test all 4 operational profiles
5. Documentation

## Project

- **Type:** typescript
- **Runtime:** bun
- **Build Tool:** bun

## Files Read

- `AGENTS.md` - Project rules, architecture, code style, testing strategy
- `ROADMAP.md` - Implementation status, v1.0 checklist, movement plan
- `package.json` - Package config, scripts, dependencies
- `src/index.ts` - Plugin entry point, hook registration, state management
- `src/agent/setu-agent.ts` - Creates .opencode/agents/setu.md with Setu persona
- `src/context/types.ts` - SetuContext interface, type definitions
- `src/context/storage.ts` - Context persistence, ContextCollector
- `src/context/feedback.ts` - Feedback mechanism for transparency
- `src/tools/setu-feedback.ts` - Tool to record user feedback

## Searches Performed

- glob: `.setu/**/*` (0 results)
- glob: `src/**/*.ts` (21 results)

## Patterns Observed

### primary-agent-architecture

Setu is a Tab-accessible primary agent with its own permissions

Examples:
- `src/agent/setu-agent.ts`

### permission-hook-defense

Permission system (CANNOT) + hooks (enforcement) for layered security

Examples:
- `src/hooks/tool-execute.ts`
- `src/enforcement/phase-zero.ts`

### context-persistence

Understanding saved to .setu/, survives sessions

Examples:
- `src/context/storage.ts`
- `src/context/types.ts`

### context-injection

Subagents receive context via prompt, don't re-read

Examples:
- `src/hooks/tool-execute.ts`
