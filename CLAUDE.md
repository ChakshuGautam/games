# Game Bench - Pangram

A monorepo framework for agent-playable games with XState state machines.

## Project Structure

```
game-bench/
├── packages/
│   ├── protocol/      # JSON-RPC message types, spaces, specs
│   ├── engine/        # (Legacy - not used, kept for reference)
│   └── transport/     # stdio, in-process transport adapters
├── games/
│   └── pangram/       # Pangram word game
│       ├── src/
│       │   ├── spec.ts       # Game specification
│       │   ├── mechanics.ts  # Pure game logic
│       │   ├── machine.ts    # XState v5 machine
│       │   └── ui/           # React components
├── apps/
│   └── web/           # Vite + React web app
```

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start dev server
pnpm dev

# Deploy to Vercel (ONLY after local verification)
vercel --prod
```

## Technology

- **State Management**: XState v5 with `@xstate/react`
- **UI**: React 19 + Tailwind CSS 4
- **Build**: Vite, tsup, Turbo
- **Package Manager**: pnpm workspaces

## Rules

1. **Always test locally before deploying** - Use `/deploy` skill
2. **Use XState properly** - Don't build custom state management
3. **Keep game logic pure** - Mechanics in separate file from machine
4. **Verify in browser** - Use Chrome DevTools MCP to test interactions
