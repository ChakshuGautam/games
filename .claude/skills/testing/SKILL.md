# Testing Skill

Proactively suggest and implement tests for code changes. This skill ensures code quality through unit tests, integration tests, and CI/CD pipelines.

## When to Activate

**Activate PROACTIVELY when:**
- New functions or modules are created
- XState machines are defined or modified
- Business logic is implemented
- APIs or interfaces are created
- Before any deployment discussion
- User asks to "build", "create", or "implement" something

**Activation triggers:**
- "create a function..."
- "implement..."
- "build a..."
- "add a feature..."
- XState `setup()` or `createMachine()` appears in code
- New `.ts` or `.tsx` files are created

## Core Principles

1. **Test at the right level**: Pure functions get unit tests, state machines get transition tests, UIs get integration tests
2. **Tests before deploy**: No code goes to production without passing tests
3. **CI is mandatory**: Every project needs automated testing in CI
4. **Mock external dependencies**: APIs, databases, and network calls should be mocked

## What to Test

### Pure Functions (mechanics, utils, helpers)
```typescript
// Test file: xxx.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './xxx.js';

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('handles edge cases', () => {
    expect(myFunction('')).toBe('default');
    expect(myFunction(null)).toThrow();
  });
});
```

### XState Machines
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createActor } from 'xstate';
import { myMachine } from './machine.js';

// Mock external services
vi.mock('./api.js', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mocked' }),
}));

describe('Machine', () => {
  it('starts in correct initial state', () => {
    const actor = createActor(myMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('transitions on events', () => {
    const actor = createActor(myMachine);
    actor.start();
    actor.send({ type: 'START' });
    expect(actor.getSnapshot().value).toBe('running');
    actor.stop();
  });

  it('guards block invalid transitions', () => {
    const actor = createActor(myMachine);
    actor.start();
    actor.send({ type: 'INVALID_EVENT' });
    expect(actor.getSnapshot().value).toBe('idle'); // unchanged
    actor.stop();
  });

  it('actions update context correctly', () => {
    const actor = createActor(myMachine);
    actor.start();
    actor.send({ type: 'INCREMENT' });
    expect(actor.getSnapshot().context.count).toBe(1);
    actor.stop();
  });
});
```

### Async Actors (invoked promises)
```typescript
it('handles async validation', async () => {
  const actor = createActor(myMachine);
  actor.start();

  actor.send({ type: 'SUBMIT', data: 'test' });

  // Wait for async transition
  await new Promise(resolve => setTimeout(resolve, 100));

  expect(actor.getSnapshot().value).toBe('success');
  actor.stop();
});
```

## CI/CD Setup

### GitHub Actions (Required)
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

### Package.json Scripts (Required)
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test File Naming

| Source File | Test File |
|-------------|-----------|
| `mechanics.ts` | `mechanics.test.ts` |
| `machine.ts` | `machine.test.ts` |
| `utils/helpers.ts` | `utils/helpers.test.ts` |

## Checklist Before Deployment

- [ ] All pure functions have unit tests
- [ ] All XState machines have transition tests
- [ ] Guards are tested (valid and invalid inputs)
- [ ] Actions are tested (context mutations)
- [ ] Async actors are tested with mocks
- [ ] CI workflow exists and passes
- [ ] `pnpm test` passes locally

## Anti-Patterns to Avoid

1. **Testing implementation details**: Test behavior, not internal structure
2. **No mocks for external APIs**: Always mock network calls
3. **Flaky async tests**: Use proper waits, not arbitrary timeouts
4. **Testing framework code**: Don't test XState itself, test your logic
5. **Skipping edge cases**: Test empty inputs, nulls, boundaries

## Integration with Other Skills

- **deploy**: Tests MUST pass before deployment
- **evaluation**: Unit tests complement agent evaluation
- **tool-design**: Tools should have unit tests for their logic

## Example Prompts That Should Trigger This Skill

- "Create a validation function"
- "Build an XState machine for..."
- "Implement the login flow"
- "Add a new feature that..."
- "Let's deploy this"
- "Push to production"
