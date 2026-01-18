---
name: pr-review
description: Reviews pull requests for code quality, security vulnerabilities, performance issues, and best practices. This skill should be used when reviewing PRs, analyzing code changes, performing code reviews, checking changes before merge, or when asked to review a diff or branch.
---

# Pull Request Review

Perform thorough code reviews using this structured approach.

## Review Process

### Step 1: Understand Context

Before reviewing code:
1. Read the PR description and linked issues
2. Understand the *why* behind the changes
3. Check if tests and documentation are included

### Step 2: Big Picture Review

Assess the overall approach:
- Is this the right solution to the problem?
- Are there simpler alternatives?
- Does it align with project architecture?
- Are there any red flags in the approach?

### Step 3: Detailed Review

Go through each dimension systematically.

## Review Dimensions

### Security (Critical)

Check for these vulnerabilities:

- [ ] **Input validation** on all user data
- [ ] **No secrets** or credentials in code
- [ ] **SQL injection prevention** using parameterized queries
- [ ] **XSS prevention** with proper escaping/sanitization
- [ ] **Authentication checks** present on protected routes
- [ ] **Authorization checks** for resource access
- [ ] **Sensitive data** not logged or exposed in errors
- [ ] **Dependencies** free of known vulnerabilities

**Red flags:**
- `eval()` or dynamic code execution
- String concatenation in SQL queries
- `dangerouslySetInnerHTML` without sanitization
- Hardcoded tokens, keys, or passwords
- Missing auth middleware on routes

### Performance (High Priority)

Check for these issues:

- [ ] **No N+1 queries** — batch database calls
- [ ] **Expensive operations** not in render path or hot loops
- [ ] **Proper caching** where beneficial
- [ ] **No memory leaks** — event listeners cleaned up
- [ ] **Large lists** virtualized (>100 items)
- [ ] **Images/assets** properly sized and optimized
- [ ] **Bundle impact** considered for new dependencies

**Red flags:**
- Database calls inside loops
- Missing pagination on list endpoints
- Large objects stored in state unnecessarily
- Missing cleanup in useEffect
- Synchronous heavy computation blocking UI

### Code Quality (Standard)

Check for these issues:

- [ ] **Single responsibility** — functions do one thing
- [ ] **No code duplication** — DRY principle followed
- [ ] **Meaningful names** — clear, descriptive identifiers
- [ ] **Appropriate error handling** — not swallowing errors
- [ ] **Edge cases covered** — nulls, empty arrays, etc.
- [ ] **No dead code** — unused variables, imports, functions
- [ ] **Consistent style** — matches project conventions

### Testing (Standard)

Check for these issues:

- [ ] **New functionality** has corresponding tests
- [ ] **Bug fixes** include regression tests
- [ ] **Tests are meaningful** — not just coverage padding
- [ ] **Edge cases tested** — boundaries, errors, empty states
- [ ] **Tests are maintainable** — not brittle or over-mocked

### Documentation (As Needed)

Check for these issues:

- [ ] **Complex logic** explained in comments
- [ ] **Public APIs** documented with JSDoc/TSDoc
- [ ] **Breaking changes** noted in PR description
- [ ] **README updated** if user-facing changes

## Feedback Format

Provide structured feedback:

```markdown
## Summary
[1-2 sentence overall assessment]

## Verdict
- [ ] Approve
- [ ] Request Changes
- [ ] Needs Discussion

## Strengths
- [What's done well]

## Required Changes (if any)
- **[severity]** `file:line` — [Issue and suggested fix]

## Suggestions (optional improvements)
- `file:line` — [Suggestion]

## Questions
- [Clarifications needed]
```

## Severity Levels

Use these severity levels for issues:

| Level | Meaning | Action Required |
|-------|---------|-----------------|
| **Blocker** | Security issue, data loss risk, crashes | Must fix before merge |
| **Major** | Bug, significant perf issue, bad pattern | Should fix |
| **Minor** | Style, naming, small improvements | Nice to fix |
| **Nitpick** | Personal preference, trivial | Optional, no action needed |

## Example Review

```markdown
## Summary
Solid implementation of user profile caching. Good use of React Query
with proper invalidation. One security concern needs addressing.

## Verdict
- [ ] Approve
- [x] Request Changes
- [ ] Needs Discussion

## Strengths
- Clean separation of cache logic from components
- Proper error boundaries with fallback UI
- Good test coverage of happy paths

## Required Changes
- **Blocker** `src/api/user.ts:45` — User ID is interpolated directly
  into SQL query. Use parameterized query to prevent SQL injection.
  
- **Major** `src/hooks/useProfile.ts:23` — Missing error handling for
  network failures. Add try-catch and surface error to UI.

## Suggestions
- `src/components/Profile.tsx:67` — Consider extracting avatar logic
  to `useAvatar` hook for reuse in comments section.

## Questions
- Is the 5-minute cache TTL intentional? Seems short for profile data
  that rarely changes.
```
