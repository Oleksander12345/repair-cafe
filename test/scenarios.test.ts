/**
 * The same scenarios run against memory and PostgreSQL storage.
 */
import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
  EVENT_CLOSED,
  MYKOLA,
  OLENA,
  TARAS,
  claim,
  complete,
  config,
  freshApp,
  key,
  register,
} from './helpers.js';

describe(`Сценарії [STORAGE=${config.storage}]`, () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    await app?.close();
    app = await freshApp();
  });
  after(() => app?.close());

  test('S1 реєстрація речі → 201, queued, історія з 1 переходу', async () => {
    const res = await register(app);
    assert.equal(res.statusCode, 201);
    const t = res.json();
    assert.equal(t.status, 'queued');
    const full = (await app.inject(`/tickets/${t.id}`)).json();
    assert.deepEqual(
      full.history.map((h: { toStatus: string }) => h.toStatus),
      ['queued'],
    );
  });

  test('S2 повтор з тим самим Idempotency-Key → 200, той самий тікет', async () => {
    const k = key();
    const a = await register(app, {}, k);
    const b = await register(app, {}, k);
    assert.equal(a.statusCode, 201);
    assert.equal(b.statusCode, 200);
    assert.equal(b.json().id, a.json().id);
  });

  test('S3 помилкові входи: закрита сесія 409, невідома 404, схема 400', async () => {
    assert.equal((await register(app, {}, key(), EVENT_CLOSED)).statusCode, 409);
    assert.equal(
      (await register(app, {}, key(), '99999999-9999-4999-8999-999999999999')).statusCode,
      404,
    );
    assert.equal((await register(app, { category: 'cars' })).statusCode, 400);
    assert.equal((await register(app, { itemDescription: '  ' })).statusCode, 400);
    const noKey = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_CLOSED}/tickets`,
      payload: { visitorName: 'a', itemDescription: 'abc', category: 'textile' },
    });
    assert.equal(noKey.statusCode, 400);
  });

  test('S4 ліміт черги: 6-та річ у сесії з лімітом 5 → 409 QUEUE_FULL', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await register(app)).statusCode, 201);
    const sixth = await register(app);
    assert.equal(sixth.statusCode, 409);
    assert.equal(sixth.json().reason, 'QUEUE_FULL');
  });

  test('S5 взяття в роботу: навичка, зайнятий майстер, вже взята річ', async () => {
    const kettle = (await register(app)).json(); // appliances
    const radio = (await register(app, { category: 'electronics' })).json();
    assert.equal((await claim(app, kettle.id, TARAS)).statusCode, 400); // Missing skill.
    const ok = await claim(app, kettle.id, OLENA);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().status, 'in_repair');
    const busy = await claim(app, radio.id, OLENA);
    assert.equal(busy.json().reason, 'VOLUNTEER_BUSY');
    assert.equal((await claim(app, radio.id, MYKOLA)).statusCode, 200);
    const taken = await claim(app, radio.id, OLENA); // Mykola already claimed it.
    assert.equal(taken.statusCode, 409);
  });

  test('S6 завершення: fixed звільняє майстра і місце в черзі', async () => {
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push((await register(app)).json().id);
    await claim(app, ids[0], OLENA);
    assert.equal((await complete(app, ids[0], OLENA, 'fixed')).json().status, 'fixed');
    assert.equal((await register(app)).statusCode, 201); // Queue capacity was released.
    assert.equal((await claim(app, ids[1], OLENA)).statusCode, 200); // Volunteer is free.
  });

  test('S7 завершити може лише призначений майстер', async () => {
    const t = (await register(app, { category: 'electronics' })).json();
    await claim(app, t.id, OLENA);
    const res = await complete(app, t.id, MYKOLA, 'fixed');
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().reason, 'NOT_ASSIGNEE');
  });

  test('S8 needs_parts → requeue → withdraw; історія повна', async () => {
    const t = (await register(app)).json();
    await claim(app, t.id, OLENA);
    await complete(app, t.id, OLENA, 'needs_parts');
    const rq = await app.inject({ method: 'POST', url: `/tickets/${t.id}/requeue` });
    assert.equal(rq.json().status, 'queued');
    const wd = await app.inject({ method: 'POST', url: `/tickets/${t.id}/withdraw` });
    assert.equal(wd.json().status, 'withdrawn');
    const h = (await app.inject(`/tickets/${t.id}`)).json().history;
    assert.deepEqual(
      h.map((x: { toStatus: string }) => x.toStatus),
      ['queued', 'in_repair', 'needs_parts', 'queued', 'withdrawn'],
    );
  });

  test('S9 заборонений перехід → 409 ILLEGAL_TRANSITION, стан не змінився', async () => {
    const t = (await register(app)).json();
    await claim(app, t.id, OLENA);
    await complete(app, t.id, OLENA, 'fixed');
    const res = await app.inject({ method: 'POST', url: `/tickets/${t.id}/requeue` });
    assert.equal(res.json().reason, 'ILLEGAL_TRANSITION');
    assert.equal((await app.inject(`/tickets/${t.id}`)).json().ticket.status, 'fixed');
  });

  test("S10 черга сесії показує ім'я майстра", async () => {
    const a = (await register(app)).json();
    await register(app, { category: 'textile' });
    await claim(app, a.id, OLENA);
    const q = (await app.inject(`/events/11111111-1111-4111-8111-111111111111/queue`)).json();
    assert.equal(q.length, 2);
    assert.equal(q[0].volunteerName, 'Олена');
    assert.equal(q[1].volunteerName, null);
  });
});
