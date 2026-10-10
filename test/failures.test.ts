/**
 * Database failure behavior. The app points to a port without PostgreSQL.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EVENT_OPEN, config, key } from './helpers.js';

describe('Збої БД', { skip: config.storage !== 'postgres' }, () => {
  let app: FastifyInstance;
  before(async () => {
    app = buildApp({ ...config, databaseUrl: 'postgres://postgres@127.0.0.1:1/repair_cafe' });
    await app.ready();
  });
  after(() => app.close());

  test('F1 liveness живий, readiness → 503', async () => {
    assert.equal((await app.inject('/health')).statusCode, 200);
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
  });

  test('F2 запис при лежачій БД → 503 + Retry-After, без витоку деталей', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_OPEN}/tickets`,
      headers: { 'idempotency-key': key() },
      payload: { visitorName: 'Ірина', itemDescription: 'Чайник', category: 'appliances' },
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['retry-after'], '5');
    assert.doesNotMatch(res.body, /ECONNREFUSED|127\.0\.0\.1/);
  });

  test('F3 читання при лежачій БД → 503, процес не падає', async () => {
    assert.equal((await app.inject('/events')).statusCode, 503);
    assert.equal((await app.inject('/health')).statusCode, 200);
  });
});
