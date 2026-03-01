# setu-opencode Roadmap

Updated: 2026-03-01

## Vision

Setu should be the most reliable way to ship AI-assisted code in OpenCode:

- understand before changing
- enforce safety before execution
- verify before completion
- preserve context across long sessions

## Current State (v1.3.4)

Shipped:

- hook-enforced Scout -> Architect -> Builder workflow
- content-first `setu_research` and `setu_plan`
- global bootstrap lifecycle (`setu init`, `setu uninstall`)
- legacy managed `~/.opencode` Setu agent cleanup during init/uninstall
- non-global install safety (no accidental global mutation)
- lazy `.setu/` creation on first Setu message
- verification tooling and persistent `.setu` artifacts

## Next (v1.4.x)

Execution quality and throughput:

- task swarm for safe parallel execution of independent work
- stronger docs and examples for real project use
- better first-run UX for project-scoped setup
- docs drift guards in contributor workflow

## Later (v2.x)

Outcome-oriented orchestration (exploratory):

- DAG-style dependency-aware execution
- goal-backward verification (prove behavior, not only commands)
- richer evidence model for completion criteria

## Future Considerations

Platform expansion (not committed):

- portable "Setu Lite" behavior for platforms without hook enforcement
- optional integrations for external tools and workflows

## Design Constraints

- Safety beats speed when risk is non-trivial.
- Public docs must match runtime behavior exactly.
- Enforcement remains hook-driven; prompt-only guidance is not enough.

## What We Intentionally Avoid

- mode/style explosion
- hidden side effects during install
- unbounded context stuffing
