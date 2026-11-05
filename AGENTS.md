# AGENTS.md - PeridotVault Desktop Development Guide

This file provides essential information for agentic coding agents (and developers) working on the PeridotVault desktop application.

## Build & Development Commands

### Development Server

```bash
npm run dev          # Start local dev server (Vite)
```

### Build & Type Checking

```bash
npm run build        # TypeScript compile + Vite build
tsc                  # Type check only (strict mode enabled)
npm run preview      # Preview production build
```

### Tauri (Desktop Build)

```bash
npm run tauri dev    # Run desktop app in dev mode
npm run tauri build  # Build production desktop binaries
```

### Testing

Currently, no test framework is configured. When tests are added:

```bash
# Run single test file (expected format)
npm test path/to/test.spec.ts
npm test -- --watch  # Watch mode
```

## Code Style Guidelines

### Formatting

- **Formatter:** Prettier (configured in `.prettierrc`)
- **Print Width:** 100 characters
- **Indentation:** 2 spaces
- **Quotes:** Single quotes (except JSX: double quotes)
- **Semicolons:** Always
- **Trailing Commas:** All (ES5+)
- **Line Endings:** LF

### TypeScript & Imports

**Import Order:**

1. External dependencies (React, viem, solana, etc.)
2. Absolute path aliases (@shared, @main, @features, etc.)
3. Relative imports (./sibling, ../parent)
4. Type imports should use `import type`

**Example:**

```typescript
import React, { useCallback } from 'react';
import { deriveEvmAddressFromSeed } from '@shared/utils/evm';
import { walletService } from '@shared/services/wallet';
import type { PGCGame } from '@shared/interfaces/game';
import { formatTitle } from '../utils/formatTitle';
```

### Path Aliases (tsconfig.json)

Use these in imports to maintain clean structure:

- `@/*` → `src/*`
- `@pages/*` → `src/areas/main/pages/*`
- `@main/*` → `src/areas/main/*`
- `@features/*` → `src/areas/main/features/*`
- `@shared/*` → `src/shared/*`
- `@core/*` → `src/core/*`

### Type Annotations

- Enable strict mode (required by tsconfig.json)
- Always annotate function parameters and returns
- Use `type` for type-only imports
- Avoid `any` - use proper types or generics
- Use discriminated unions for complex state

**Example:**

```typescript
export async function fetchGames(address: string): Promise<PGCGame[]> {
  // Implementation
}

type GameStatus = 'owned' | 'installed' | 'installing';

interface RealLibraryGame {
  gameId: string;
  name: string;
  status: GameStatus;
}
```

### Naming Conventions

- **Files/Folders:** kebab-case (e.g., `game-card.tsx`, `library-service.ts`)
- **Variables/Functions:** camelCase (e.g., `fetchGames`, `gameCount`)
- **Types/Interfaces:** PascalCase (e.g., `PGCGame`, `LibraryEntry`)
- **Constants:** SCREAMING_SNAKE_CASE (e.g., `REGISTRY_ADDRESS`)
- **Booleans:** Prefix with `is`, `has`, `can` (e.g., `isLoading`, `hasError`)
- **Event Handlers:** Prefix with `handle` (e.g., `handleConfirm`, `onClick`)
- **React Components:** PascalCase file names (e.g., `GameCard.tsx`)

### Error Handling

**Use try-catch with proper context:**

```typescript
try {
  const result = await fetchData();
} catch (err) {
  console.error('[FeatureContext] Failed to fetch data:', err);
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

**Context Logging Pattern:**

- Use square brackets `[Module/Feature]` prefix for console logs
- Example: `console.warn('[useMyGames] Failed to query runtime DB:', error)`
- Always include the context for debugging multi-blockchain scenarios

**HTTP Responses:**

```typescript
const response = await fetch(uri);
if (!response.ok) {
  throw new Error(`Failed: ${response.status} ${response.statusText}`);
}
const data = await response.json();
```

**Validation:**

```typescript
if (!metadata || !metadata.name) {
  console.warn(`[Service] Skipping invalid game: ${gameId}`);
  return null; // or continue in loops
}
```

### React & Hooks

**Component Structure:**

```typescript
interface ComponentProps {
  prop1: string;
  onClick: () => void;
}

export const ComponentName: React.FC<ComponentProps> = ({ prop1, onClick }) => {
  const [state, setState] = React.useState<Type>(initial);

  React.useEffect(() => {
    // Effect logic
  }, [dependency]);

  return <div>{prop1}</div>;
};
```

**Hooks Usage:**

- Use named hooks from `src/areas/main/features/*/hooks/` pattern
- Always include proper dependency arrays in `useEffect`
- Use `useCallback` for handler props to prevent unnecessary re-renders
- Use `useMemo` for expensive computations

### Multi-Blockchain Architecture

**When Fetching Games:**

1. Games can come from **EVM (Base Sepolia)** or **Solana (Devnet)**
2. Both blockchains are queried in `useMyGames` hook
3. Add blockchain context in metadata: `metadata._blockchain = 'base-sepolia' | 'solana'`
4. Log blockchain failures separately for debugging

**Blockchain Service Pattern:**

```typescript
// src/shared/blockchain/{evm|solana}/services/game.ts
export async function getMyGames({ address }: { address: string }): Promise<PGCGame[]> {
  try {
    // Fetch from blockchain
    // Validate metadata (skip if name missing)
    // Log blockchain-specific context
  } catch (error) {
    console.error('[BlockchainName] Error:', error);
    return []; // Graceful fallback
  }
}
```

### Environment Variables

- Defined in `.env` and `.env.local`
- Access via `import.meta.env.VITE_*`
- Critical variables:
  - `VITE_API_BASE`: Dev API endpoint (https://api-dev.peridotvault.com)
  - `VITE_EVM_RPC_URL`: Base Sepolia RPC
  - `VITE_SVM_RPC_URL`: Solana Devnet RPC
  - `VITE_ENCRYPTION_KEY`: Wallet encryption key

### Database (Dexie)

- Local database stored in `src/core/storage/storage.db.ts`
- Tables: `kv` (key-value), `library` (game entries)
- Use async/await patterns with Dexie queries
- All game data saved locally for offline access

**Example:**

```typescript
export async function getById(gameId: GameId): Promise<LibraryEntry | undefined> {
  return await libraryService.getById(gameId);
}
```

## Performance Best Practices

### Library Page - Instant Loading Pattern

The library page uses a **multi-stage loading strategy** for optimal UX:

**Stage 1: Instant Display (< 50ms)**

```typescript
// Load from local Dexie database immediately
const localEntries = await libraryService.getAll();
if (localEntries.length > 0) {
  setGames(convertAndSort(localEntries));
  setLoading(false); // UI becomes responsive NOW
}
```

**Stage 2: Incremental Loading**

```typescript
// Add games one by one as they're fetched
const addGameIncremental = useCallback((game: PGCGame) => {
  setGames((prevGames) => {
    if (prevGames.some((g) => g.gameId === game.gameId)) {
      return prevGames; // Already loaded
    }
    const newGames = [...prevGames, convertToDisplayGame(game)];
    return newGames.sort((a, b) => a.name.localeCompare(b.name));
  });
}, []);

// In fetch loop:
for (const game of games) {
  addGameIncremental(game); // Appears in UI immediately
  await saveGameToLibrary(game); // Saved to Dexie in background
}
```

**Stage 3: Background Sync**

```typescript
// After UI is responsive, sync with blockchain/API
setSyncing(true);
// Fetch from API/blockchain
// Update games incrementally
setSyncing(false);
```

### Key Principles for Responsive UI

1. **Never Block the Main Thread**
   - Load from local storage first
   - Show data immediately
   - Fetch fresh data in background

2. **Incremental Updates**
   - Show first game as soon as it's available
   - Don't wait for all games to load
   - Use functional setState to avoid race conditions

3. **Smart Loading States**

   ```typescript
   // Show loading spinner only when BOTH:
   // - No cached data AND
   // - Currently fetching
   if ((loading || syncing) && games.length === 0) {
     return <LoadingSpinner />;
   }

   // Show "empty" only after everything is complete
   const isEmpty = !loading && !syncing && games.length === 0;
   ```

4. **Background Persistence**
   - Save every game to Dexie as it's fetched
   - Update existing entries with fresh data
   - Full game details stored for offline mode

### Library State Management (Zustand Store)

The library uses a **shared Zustand store** (`useLibraryStore`) to ensure all components (sidebar, main page, etc.) see the same data:

```typescript
// src/areas/main/features/library/hooks/useLibraryStore.ts
export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],           // Shared library entries
  isLoading: true,       // Shared loading state
  isSyncing: false,      // Shared sync state

  // Load from local DB
  async loadAll() {
    const entries = await libraryService.getAll();
    set({ entries, isLoading: false });
  },

  // Add new entry (prevents duplicates)
  async addEntry(input: CreateLibraryEntryInput) {
    const existing = get().entries.find(e => e.gameId === input.gameId);
    if (existing) return;
    const entry = await libraryService.create(input);
    set(state => ({
      entries: [...state.entries, entry].sort(...)
    }));
  },

  // Update existing entry
  async updateEntry(gameId: string, patch: Partial<LibraryEntry>) {
    await libraryService.update(gameId, patch);
    set(state => ({
      entries: state.entries.map(e =>
        e.gameId === gameId ? { ...e, ...patch } : e
      ),
    }));
  },
}));
```

**Why shared state is critical:**
- Sidebar and main page both use `useMyGames()` hook
- Without shared state, each component instance has its own `games` array
- When sidebar fetches games, main page stays empty
- Shared store ensures all components update together

**Usage in components:**
```typescript
// useMyGames hook wraps the store
export function useMyGames() {
  const storeEntries = useLibraryStore((state) => state.entries);
  const storeLoadAll = useLibraryStore((state) => state.loadAll);

  // Load on mount
  useEffect(() => {
    storeLoadAll();
  }, [storeLoadAll]);

  // Convert entries to display format
  const games = convertEntriesToGames(storeEntries);

  // Background sync runs separately
  useEffect(() => {
    // Fetch from API/blockchain
    // Call storeAddEntry() for each game
  }, [...]);

  return { games, loading: storeLoading, ... };
}
```

### Anti-Patterns to Avoid

❌ **Don't do this:**

```typescript
// BAD: Wait for all games before showing anything
const allGames = await fetchAllGames(); // Takes 5-10 seconds
setGames(allGames);
setLoading(false);
```

✅ **Do this instead:**

```typescript
// GOOD: Show cached games immediately, add new ones incrementally
const cachedGames = await libraryService.getAll();
setGames(cachedGames);
setLoading(false);

// Then add new games one by one
for (const game of fetchedGames) {
  addGameIncremental(game);
}
```

❌ **Don't do this:**

```typescript
// BAD: Replace entire array on each update
setGames([...games, newGame]); // Loses previous state if re-rendered
```

✅ **Do this instead:**

```typescript
// GOOD: Use functional update
setGames((prevGames) => [...prevGames, newGame]);
```

## Key Principles

1. **Strict TypeScript:** No `any` types, strict null checks enabled
2. **Error Context:** Always include module context in logs `[ModuleName]`
3. **Graceful Degradation:** Return empty arrays/null instead of throwing in service layers
4. **No Unused Variables:** TypeScript `noUnusedLocals` and `noUnusedParameters` enforced
5. **Async Best Practices:** Avoid promise hell - use async/await, proper error handling
6. **Path Aliases:** Always use aliases over relative imports when available
7. **Component Composition:** Break large components into smaller, focused components
8. **Performance First:** Never block UI - load instantly, sync in background
9. **Offline Support:** Save all data to Dexie for offline access
10. **Incremental Loading:** Show data as soon as it's available, don't batch

## Repository Info

- **Type:** Tauri + React + TypeScript desktop app
- **Build Tool:** Vite 7.3.1
- **Package Manager:** pnpm
- **Framework:** React 19.2.4
- **State Management:** Zustand 5.0.12
- **Blockchain:** viem (EVM), @solana/web3.js (Solana)
- **UI:** Tailwind CSS 4.2.2, Material-UI 7.3.9
- **Local Database:** Dexie.js (IndexedDB wrapper)
