/**
 * Concurrent requests against the same resource exercise invariants I1–I4.
 * PostgreSQL runs these requests through separate pool connections.
 */
import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { MYKOLA, OLENA, claim, config, freshApp, key, register } from './helpers.js';

const count = (codes: number[], c: number) => codes.filter((x) => x === c).length;

describe(`Конкурентність [STORAGE=${config.storage}]`, () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    await app?.close();
    app = await freshApp();
  });
  after(() => app?.close());

  test('C1 (I3) 12 паралельних реєстрацій при ліміті 5 → рівно 5 створено', async () => {
    const res = await Promise.all(Array.from({ length: 12 }, () => register(app)));
    const codes = res.map((r) => r.statusCode);
    assert.equal(count(codes, 201), 5, `codes: ${codes.join(',')}`);
    assert.equal(count(codes, 409), 7);
  });

  test('C2 (I1) двоє майстрів одночасно беруть одну річ → рівно один успіх', async () => {
    const t = (await register(app, { category: 'electronics' })).json();
    const codes = (await Promise.all([claim(app, t.id, OLENA), claim(app, t.id, MYKOLA)])).map(
      (r) => r.statusCode,
    );
    assert.equal(count(codes, 200), 1, `codes: ${codes.join(',')}`);
    const history = (await app.inject(`/tickets/${t.id}`)).json().history;
    assert.equal(history.length, 2, 'рівно один перехід у in_repair');
  });

  test('C3 (I2) майстер одночасно бере дві речі → рівно одна в роботі', async () => {
    const a = (await register(app, { category: 'electronics' })).json();
    const b = (await register(app, { category: 'electronics' })).json();
    const codes = (await Promise.all([claim(app, a.id, OLENA), claim(app, b.id, OLENA)])).map(
      (r) => r.statusCode,
    );
    assert.equal(count(codes, 200), 1, `codes: ${codes.join(',')}`);
  });

  test('C4 (I4) 6 паралельних повторів з одним ключем → один тікет, без 5xx', async () => {
    const k = key('dup');
    const res = await Promise.all(Array.from({ length: 6 }, () => register(app, {}, k)));
    const codes = res.map((r) => r.statusCode);
    assert.ok(
      codes.every((c) => c === 200 || c === 201),
      `codes: ${codes.join(',')}`,
    );
    assert.equal(new Set(res.map((r) => r.json().id)).size, 1);
  });

  test('C5 (I4) той самий ключ з іншим тілом → 409, а не чужий тікет', async () => {
    const k = key('reuse');
    const first = await register(app, { itemDescription: 'Чайник не гріє' }, k);
    const second = await register(
      app,
      { itemDescription: 'Велосипед: вісімка', category: 'bicycles' },
      k,
    );
    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 409, `got ${second.statusCode}, id ${second.json().id}`);
  });
});
