import type { Reveal } from '../../shared/types';

/**
 * Local memory for what the server cannot hold: the answer tapped in the feed
 * before the full game opens, and progress for players who are not logged in.
 * Storage can be unavailable (private windows, previews), so every call is guarded.
 */
const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Play continues without local memory.
  }
};

const remove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
};

export type Pending = { q: number; option: number };

const pendingKey = (edition: number) => `ayn:pending:${edition}`;
const localKey = (edition: number) => `ayn:local:${edition}`;

export const pending = {
  get: (edition: number) => read<Pending>(pendingKey(edition)),
  set: (edition: number, value: Pending) => write(pendingKey(edition), value),
  clear: (edition: number) => remove(pendingKey(edition)),
};

export type LocalDay = {
  answers: (number | null)[];
  reveals: (Reveal | null)[];
};

export const localDay = {
  get: (edition: number) => read<LocalDay>(localKey(edition)),
  set: (edition: number, value: LocalDay) => write(localKey(edition), value),
};
