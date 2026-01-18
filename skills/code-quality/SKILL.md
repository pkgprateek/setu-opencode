---
name: code-quality
description: Enforces code quality standards including naming conventions, error handling, testing patterns, and code structure. This skill should be used when writing new code, reviewing changes, refactoring existing modules, fixing bugs, or when asking about best practices and coding standards.
---

# Code Quality Standards

Apply these standards when writing, reviewing, or refactoring code.

## Naming Conventions

Follow these naming patterns consistently:

| Type | Pattern | Examples |
|------|---------|----------|
| Functions | verb-first, camelCase | `getUserById`, `calculateTotal`, `validateInput` |
| Components | PascalCase, descriptive | `UserProfileCard`, `PaymentModal`, `SearchFilter` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `API_BASE_URL` |
| Booleans | question-form prefix | `isLoading`, `hasPermission`, `canEdit`, `shouldRefresh` |
| Event handlers | handle + Event | `handleClick`, `handleSubmit`, `handleChange` |
| Hooks | use + Purpose | `useAuth`, `useLocalStorage`, `useFetch` |

## Error Handling

Apply these error handling principles:

1. **Never swallow errors silently** — always log or propagate
2. **Prefer custom error types** for domain-specific failures
3. **Log with context** — include what operation failed and what inputs caused it
4. **Separate user messages from technical details** — users see friendly text, logs get stack traces
5. **Use early returns** for error conditions to reduce nesting

**Pattern: Proper error handling**
```typescript
// Correct: Explicit error with context
if (!user) {
  throw new UserNotFoundError(`User ${id} not found in database`);
}

// Incorrect: Silent failure
try {
  doSomething();
} catch (e) {
  // Never do this
}
```

## Testing Philosophy

Apply these testing principles:

1. **TDD for bugs** — Write the failing test first, then fix
2. **Test behavior, not implementation** — Tests should survive refactoring
3. **One assertion per test** when practical — easier to debug failures
4. **Name tests as sentences** — `it('returns null when user not found')`
5. **Arrange-Act-Assert structure** — clear separation of setup, action, verification

**Pattern: Good test structure**
```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('returns user when found', async () => {
      // Arrange
      const userId = 'user-123';
      await createTestUser({ id: userId });
      
      // Act
      const result = await userService.getUserById(userId);
      
      // Assert
      expect(result).toMatchObject({ id: userId });
    });

    it('returns null when user not found', async () => {
      const result = await userService.getUserById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
```

## Code Structure

Apply these structural principles:

1. **Single responsibility** — Functions should do one thing
2. **Self-documenting code** — If a function needs comments to explain *what* it does, refactor it
3. **Maximum ~30 lines** per function (guideline, not law)
4. **Prefer early returns** over deep nesting
5. **Extract repeated patterns** into utilities

**Pattern: Early returns vs deep nesting**
```typescript
// Correct: Early returns, flat structure
function processUser(user: User): ProcessedUser | null {
  if (!user) return null;
  if (!user.isActive) return null;
  if (!user.hasValidSubscription) return null;
  
  return transformUser(user);
}

// Incorrect: Deep nesting
function processUser(user: User): ProcessedUser | null {
  if (user) {
    if (user.isActive) {
      if (user.hasValidSubscription) {
        return transformUser(user);
      }
    }
  }
  return null;
}
```

## Import Organization

Organize imports in this order:

1. External packages (react, lodash, etc.)
2. Internal aliases (@/components, @/utils)
3. Relative imports (./Component, ../utils)
4. Type imports (import type { ... })

Separate each group with a blank line.
