---
name: commit-helper
description: Generates clear, consistent commit messages following conventional commit format. This skill should be used when writing commit messages, preparing commits, reviewing staged changes, or when asked about commit message best practices.
---

# Commit Message Standards

Generate commit messages following these standards.

## Format

```
type(scope): concise description (max 50 chars)

[optional body explaining what and why, wrapped at 72 chars]

[optional footer with breaking changes or issue refs]
```

## Commit Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature or capability | `feat(auth): add OAuth2 login with Google` |
| `fix` | Bug fix | `fix(cart): prevent duplicate items on rapid clicks` |
| `refactor` | Code change without behavior change | `refactor(api): extract common error handling` |
| `docs` | Documentation only | `docs(readme): add deployment instructions` |
| `test` | Adding or updating tests | `test(user): add edge cases for validation` |
| `chore` | Build, config, tooling | `chore(deps): upgrade React to v19` |
| `style` | Formatting, whitespace only | `style(lint): fix ESLint warnings` |
| `perf` | Performance improvement | `perf(images): add lazy loading` |

## Process

To generate a commit message:

1. Run `git diff --staged` to analyze changes
2. Identify the primary type of change
3. Determine the scope (affected module/component)
4. Write summary under 50 characters
5. Add body if the *why* isn't obvious from the summary
6. Reference issues if applicable

## Guidelines

**Summary line:**
- Use present tense: "add feature" not "added feature"
- Use imperative mood: "fix bug" not "fixes bug"
- Do not end with period
- Maximum 50 characters (hard limit)

**Body (when needed):**
- Explain *what* and *why*, not *how* (code shows how)
- Wrap at 72 characters
- Separate from summary with blank line
- Use bullet points for multiple items

**Footer (when applicable):**
- Reference issues: `fixes #123` or `closes #456`
- Note breaking changes: `BREAKING CHANGE: description`

## Examples

**Simple fix:**
```
fix(auth): handle expired refresh tokens gracefully
```

**Feature with context:**
```
feat(auth): add OAuth2 login with Google

Implement Google OAuth2 flow for user authentication.
Store refresh tokens securely in encrypted storage.
Add automatic token refresh before expiration.

closes #234
```

**Bug fix with explanation:**
```
fix(cart): prevent duplicate items on rapid clicks

Add debounce to add-to-cart button to prevent race
condition when user clicks multiple times quickly.
The 300ms debounce matches our UX guidelines.

fixes #567
```

**Refactoring:**
```
refactor(api): extract common error handling

Move repeated try-catch patterns into shared
handleApiError utility. Reduces duplication across
15 API call sites and ensures consistent error
formatting.

- Add ApiError class with status codes
- Create handleApiError wrapper function
- Update all API calls to use new pattern
```

**Breaking change:**
```
feat(api): change user endpoint response format

BREAKING CHANGE: User endpoint now returns nested
profile object instead of flat structure.

Before: { id, name, email }
After: { id, profile: { name, email } }

Migration: Update all user.name references to
user.profile.name
```
