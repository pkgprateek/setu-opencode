---
name: refine-code
description: Refines and transforms code to match codebase standards. This skill should be used when the user says they made changes, created a mockup, updated code, wants code cleaned up, asks to refine or improve code, or when integrating new code that needs to match project conventions.
---

# Refining Code

Apply these guidelines when refining code to match codebase standards.

## Core Principles

1. **Respect the intent** — The original structure often has merit
2. **Apply our patterns** — Transform naming, file structure, component design
3. **Remove excess** — Often there's over-generated or redundant code
4. **Add missing essentials** — Error handling, accessibility, types

## Transformation Workflow

### Step 1: Assess the Input

Review the code to understand:
- What is the core functionality?
- What structural decisions are worth keeping?
- What needs complete replacement vs. refinement?

### Step 2: Transform Naming and Structure

Apply these transformations:

| Pattern Found | Transform To |
|---------------|--------------|
| Generic names (`div1`, `Container2`) | Semantic, descriptive names |
| `any` types | Proper TypeScript interfaces |
| Inline styles | Styled-components or CSS modules |
| Hardcoded strings | Constants or i18n keys |
| Magic numbers | Named constants |

### Step 3: Apply Refinement Checklist

**Structure & Naming**
- [ ] Component/function names follow conventions (PascalCase components, camelCase functions)
- [ ] File structure matches project patterns
- [ ] Imports organized and cleaned (externals, internals, relatives, types)

**TypeScript**
- [ ] All props properly typed (no `any`)
- [ ] Return types explicit where helpful
- [ ] Interfaces/types extracted to appropriate location
- [ ] Generic types used where beneficial

**Code Quality**
- [ ] Hardcoded strings extracted to constants or i18n
- [ ] Inline styles converted to styling system
- [ ] Generic class names replaced with meaningful names
- [ ] Magic numbers replaced with named constants
- [ ] Unused imports and dead code removed
- [ ] Console.logs removed (or converted to proper logging)

**UX Completeness**
- [ ] Loading states handled
- [ ] Error states handled with user-friendly messages
- [ ] Empty states handled
- [ ] Accessibility: ARIA labels, keyboard navigation, focus management
- [ ] Responsive behavior considered

### Step 4: Document Transformations

Note significant changes made:
```
## Refinements Applied

### Naming
- Renamed `Container1` → `UserProfileCard`
- Renamed `handleStuff` → `handleProfileUpdate`

### Structure
- Extracted `UserAvatar` as separate component
- Moved types to `types/user.ts`

### Added
- Loading state with skeleton
- Error boundary
- Keyboard navigation

### Removed
- Unused `tempData` variable
- Console.log statements
- Inline styles (moved to styled-components)
```

## Common Patterns to Fix

| Pattern | Problem | Fix |
|---------|---------|-----|
| Inline styles everywhere | Unmaintainable, no theming | Extract to styled-components or CSS modules |
| `any` types scattered | No type safety | Define proper interfaces based on data shape |
| Hardcoded text in JSX | Not i18n-ready, hard to update | Extract to constants or translation keys |
| Missing error handling | App crashes on failure | Add try-catch, error boundaries, fallback UI |
| No loading states | Poor UX, layout shift | Add suspense, skeletons, or spinners |
| Overly complex single file | Hard to maintain | Split into focused components/modules |
| No accessibility | Excludes users, legal risk | Add ARIA, keyboard nav, focus management |
