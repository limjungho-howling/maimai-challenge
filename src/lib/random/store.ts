import {
  emptyRandomPoolState,
  readStoredState,
  writeStoredState,
  type RandomPoolState,
} from "@/lib/random/storage";

/**
 * localStorage is the source of truth for the pool, so the picker reads it
 * through `useSyncExternalStore` instead of mirroring it into component state.
 * The server render and the hydration render both see the empty snapshot.
 */
const SERVER_SNAPSHOT = emptyRandomPoolState();
const listeners = new Set<() => void>();

let snapshot: RandomPoolState | null = null;

export function subscribeRandomPoolStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRandomPoolSnapshot(): RandomPoolState {
  snapshot ??= readStoredState();
  return snapshot;
}

export function getRandomPoolServerSnapshot(): RandomPoolState {
  return SERVER_SNAPSHOT;
}

export function updateRandomPoolStore(
  update: (state: RandomPoolState) => RandomPoolState,
): void {
  const current = getRandomPoolSnapshot();
  const next = update(current);

  if (next === current) {
    return;
  }

  snapshot = next;
  writeStoredState(next);

  for (const listener of [...listeners]) {
    listener();
  }
}

/** Drops the cached snapshot so the next read goes back to storage. */
export function resetRandomPoolStore(): void {
  snapshot = null;
}
