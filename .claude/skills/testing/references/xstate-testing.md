# XState Testing Patterns

Comprehensive guide for testing XState v5 machines.

## Setup

```bash
pnpm add -D vitest
```

```typescript
// vitest.config.ts (optional)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

## Basic Machine Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createActor, type Actor } from 'xstate';
import { myMachine } from './machine.js';

describe('MyMachine', () => {
  let actor: Actor<typeof myMachine>;

  beforeEach(() => {
    actor = createActor(myMachine);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  // Tests go here
});
```

## Testing State Transitions

```typescript
describe('State Transitions', () => {
  it('transitions from idle to loading on FETCH', () => {
    expect(actor.getSnapshot().value).toBe('idle');

    actor.send({ type: 'FETCH' });

    expect(actor.getSnapshot().value).toBe('loading');
  });

  it('stays in idle if guard fails', () => {
    // Set up context that makes guard fail
    actor = createActor(myMachine, {
      input: { isDisabled: true }
    });
    actor.start();

    actor.send({ type: 'FETCH' });

    expect(actor.getSnapshot().value).toBe('idle'); // Guard blocked
  });
});
```

## Testing Context Updates

```typescript
describe('Context Updates', () => {
  it('updates count on INCREMENT', () => {
    expect(actor.getSnapshot().context.count).toBe(0);

    actor.send({ type: 'INCREMENT' });

    expect(actor.getSnapshot().context.count).toBe(1);
  });

  it('adds item to list', () => {
    actor.send({ type: 'ADD_ITEM', item: 'test' });

    expect(actor.getSnapshot().context.items).toContain('test');
  });
});
```

## Testing Guards

```typescript
describe('Guards', () => {
  it('canSubmit requires 4+ characters', () => {
    // Less than 4 characters - guard should block
    actor.send({ type: 'ADD_CHAR', char: 'a' });
    actor.send({ type: 'ADD_CHAR', char: 'b' });
    actor.send({ type: 'SUBMIT' });

    expect(actor.getSnapshot().value).toBe('editing'); // Blocked

    // Add more characters
    actor.send({ type: 'ADD_CHAR', char: 'c' });
    actor.send({ type: 'ADD_CHAR', char: 'd' });
    actor.send({ type: 'SUBMIT' });

    expect(actor.getSnapshot().value).toBe('submitting'); // Allowed
  });
});
```

## Testing Async Actors (Invoked Promises)

```typescript
import { vi } from 'vitest';

// Mock the API module
vi.mock('./api.js', () => ({
  fetchUser: vi.fn(),
}));

import { fetchUser } from './api.js';

describe('Async Actors', () => {
  it('handles successful API call', async () => {
    // Setup mock to resolve
    vi.mocked(fetchUser).mockResolvedValue({ id: 1, name: 'Test' });

    actor.send({ type: 'FETCH_USER', userId: 1 });

    // Wait for async completion
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('success');
    });

    expect(actor.getSnapshot().context.user).toEqual({ id: 1, name: 'Test' });
  });

  it('handles API error', async () => {
    vi.mocked(fetchUser).mockRejectedValue(new Error('Network error'));

    actor.send({ type: 'FETCH_USER', userId: 1 });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('error');
    });

    expect(actor.getSnapshot().context.error).toBe('Network error');
  });
});
```

## Testing with Input

```typescript
describe('Machine with Input', () => {
  it('initializes with provided input', () => {
    const actor = createActor(myMachine, {
      input: {
        initialCount: 10,
        userId: 'abc123'
      }
    });
    actor.start();

    expect(actor.getSnapshot().context.count).toBe(10);
    expect(actor.getSnapshot().context.userId).toBe('abc123');

    actor.stop();
  });
});
```

## Testing Nested States

```typescript
describe('Nested States', () => {
  it('handles nested state transitions', () => {
    actor.send({ type: 'START' });

    // Check nested state value
    expect(actor.getSnapshot().value).toEqual({
      active: 'editing'
    });

    actor.send({ type: 'SAVE' });

    expect(actor.getSnapshot().value).toEqual({
      active: 'saving'
    });
  });
});
```

## Testing Parallel States

```typescript
describe('Parallel States', () => {
  it('manages multiple regions independently', () => {
    expect(actor.getSnapshot().value).toEqual({
      upload: 'idle',
      validation: 'idle'
    });

    actor.send({ type: 'START_UPLOAD' });

    expect(actor.getSnapshot().value).toEqual({
      upload: 'uploading',
      validation: 'idle' // Independent
    });
  });
});
```

## Snapshot Testing

```typescript
describe('Snapshot Tests', () => {
  it('matches expected state shape', () => {
    actor.send({ type: 'INITIALIZE' });

    expect(actor.getSnapshot().context).toMatchSnapshot();
  });
});
```

## Testing Event Sequences

```typescript
describe('Event Sequences', () => {
  it('handles complete user flow', async () => {
    // Login flow
    actor.send({ type: 'ENTER_EMAIL', email: 'test@example.com' });
    actor.send({ type: 'ENTER_PASSWORD', password: 'secret' });
    actor.send({ type: 'SUBMIT' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('authenticated');
    });

    // Use authenticated features
    actor.send({ type: 'VIEW_PROFILE' });
    expect(actor.getSnapshot().value).toBe('profile');

    // Logout
    actor.send({ type: 'LOGOUT' });
    expect(actor.getSnapshot().value).toBe('idle');
  });
});
```

## Helper Functions for Tests

```typescript
// test-utils.ts
import { createActor, type AnyActorLogic } from 'xstate';

export function createTestActor<T extends AnyActorLogic>(
  machine: T,
  input?: Parameters<typeof createActor<T>>[1]
) {
  const actor = createActor(machine, input);
  actor.start();
  return actor;
}

export async function waitForState(
  actor: ReturnType<typeof createActor>,
  expectedState: string,
  timeout = 1000
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (actor.getSnapshot().value === expectedState) {
      return;
    }
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`Timeout waiting for state: ${expectedState}`);
}
```

## Common Mistakes

### 1. Forgetting to stop actors
```typescript
// BAD - memory leak
it('tests something', () => {
  const actor = createActor(machine);
  actor.start();
  // No actor.stop()!
});

// GOOD
it('tests something', () => {
  const actor = createActor(machine);
  actor.start();
  // ... test
  actor.stop(); // Clean up
});
```

### 2. Not waiting for async transitions
```typescript
// BAD - flaky test
it('handles async', () => {
  actor.send({ type: 'FETCH' });
  expect(actor.getSnapshot().value).toBe('success'); // May fail!
});

// GOOD
it('handles async', async () => {
  actor.send({ type: 'FETCH' });
  await vi.waitFor(() => {
    expect(actor.getSnapshot().value).toBe('success');
  });
});
```

### 3. Testing XState internals
```typescript
// BAD - testing framework, not your code
it('has correct state definition', () => {
  expect(machine.states.idle).toBeDefined(); // Don't do this
});

// GOOD - test behavior
it('starts in idle state', () => {
  const actor = createActor(machine);
  actor.start();
  expect(actor.getSnapshot().value).toBe('idle');
  actor.stop();
});
```
