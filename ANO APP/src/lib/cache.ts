import type { PendingMutation } from './app-types';

const pendingKey = 'ano-sync-pending';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function cacheGet<T>(key: string, fallback: T): T {
  return readJson(key, fallback);
}

export function cacheSet<T>(key: string, value: T) {
  writeJson(key, value);
}

export function getPendingMutations() {
  return readJson<PendingMutation[]>(pendingKey, []);
}

export function pushPendingMutation(mutation: PendingMutation) {
  const current = getPendingMutations();
  writeJson(pendingKey, [...current, mutation]);
}

export function clearPendingMutation(id: string) {
  const remaining = getPendingMutations().filter((mutation) => mutation.id !== id);
  writeJson(pendingKey, remaining);
}

export function replacePendingMutations(mutations: PendingMutation[]) {
  writeJson(pendingKey, mutations);
}
