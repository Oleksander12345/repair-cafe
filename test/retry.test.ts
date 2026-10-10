import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withRetry } from '../src/adapters/postgres/retry.js';

const noSleep = { sleep: async () => undefined };
const deadlock = Object.assign(new Error('deadlock detected'), { code: '40P01' });

test('R1 deadlock → повтор, другий раз успіх', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    if (++calls === 1) throw deadlock;
    return 'ok';
  }, noSleep);
  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('R2 повторів не більше attempts, далі помилка назовні', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw deadlock;
    }, noSleep),
    /deadlock/,
  );
  assert.equal(calls, 3);
});

test('R3 доменні та інші помилки не повторюються', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw Object.assign(new Error('unique'), { code: '23505' });
    }, noSleep),
  );
  assert.equal(calls, 1);
});
