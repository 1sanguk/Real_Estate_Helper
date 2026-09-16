export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const SESSION_ACTIVITY_STORAGE_KEY = 'real-estate-helper:last-session-activity';

type SessionActivityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function hasSessionActivityExpired(
  storage: SessionActivityStorage,
  now = Date.now(),
): boolean {
  const storedValue = storage.getItem(SESSION_ACTIVITY_STORAGE_KEY);
  if (!storedValue) return false;
  const lastActivityAt = Number(storedValue);
  return !Number.isFinite(lastActivityAt)
    || now - lastActivityAt >= SESSION_INACTIVITY_TIMEOUT_MS;
}

export function recordSessionActivity(
  storage: SessionActivityStorage,
  now = Date.now(),
): void {
  storage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(now));
}

export function clearSessionActivity(storage: SessionActivityStorage): void {
  storage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
}
