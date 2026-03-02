---
title: Planning Contract
description: How Setu uses research and planning contracts to raise quality without losing model flexibility.
---

# Planning Contract

Setu uses two quality contracts:

- Research contract (`setu_research`)
- Plan contract (`setu_plan`)

These contracts guide output quality while hooks enforce control flow.

## Research contract expectations

Good research includes:

- intent and problem framing
- technical analysis
- alternatives and tradeoffs
- risks and failure modes
- verification strategy
- open decisions

## Plan contract expectations

Good plans include:

- atomic implementation steps
- why each step exists
- files touched and change intent
- verification method
- rollback and edge-case awareness

## Key distinction

- Hooks enforce what can run and when.
- Contracts guide artifact quality.

This keeps Setu both strict (safety/workflow) and flexible (model-authored structure).
