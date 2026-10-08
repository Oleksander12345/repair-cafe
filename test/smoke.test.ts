import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { assertTransition, canRepair, canTransition } from '../src/modules/tickets/index.js';
import { DomainError } from '../src/shared/errors.js';

const config = { ...loadConfig({}), logLevel: 'silent', gitSha: 'test-sha' };

test('GET /health -> 200 ok', async () => {
  const app = buildApp(config);
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });
  await app.close();
});

test('GET /version -> sha з конфігурації', async () => {
  const app = buildApp(config);
  const res = await app.inject({ method: 'GET', url: '/version' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().version, 'test-sha');
  await app.close();
});

test('статуси: дозволені й заборонені переходи', () => {
  assert.equal(canTransition('queued', 'in_repair'), true);
  assert.equal(canTransition('needs_parts', 'queued'), true);
  assert.equal(canTransition('fixed', 'queued'), false);
  assert.equal(canTransition('queued', 'fixed'), false);
});

test('canRepair: майстер з велосипедами не бере електроніку', () => {
  assert.equal(canRepair(['bicycles'], 'electronics'), false);
  assert.equal(canRepair(['bicycles', 'electronics'], 'electronics'), true);
});

test('invalid transition returns a domain conflict, not an HTTP error', () => {
  assert.throws(
    () => assertTransition('fixed', 'in_repair'),
    (error: unknown) => error instanceof DomainError && error.code === 'CONFLICT',
  );
});
