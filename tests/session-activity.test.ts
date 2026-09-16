import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearSessionActivity,
  hasSessionActivityExpired,
  recordSessionActivity,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from '../features/auth/session-activity.ts';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

void test('30분 동안 활동이 없으면 세션이 만료된다', () => {
  const storage = createStorage();
  recordSessionActivity(storage, 1_000);

  assert.equal(hasSessionActivityExpired(storage, 1_000 + SESSION_INACTIVITY_TIMEOUT_MS - 1), false);
  assert.equal(hasSessionActivityExpired(storage, 1_000 + SESSION_INACTIVITY_TIMEOUT_MS), true);
});

void test('활동 기록이 없거나 제거된 새 세션은 즉시 만료하지 않는다', () => {
  const storage = createStorage();
  assert.equal(hasSessionActivityExpired(storage), false);

  recordSessionActivity(storage, 1_000);
  clearSessionActivity(storage);
  assert.equal(hasSessionActivityExpired(storage), false);
});
