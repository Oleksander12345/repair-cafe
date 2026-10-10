import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { EVENT_OPEN, OLENA, claim, complete, config, freshApp, key, register } from './helpers.js';

test(
  'I3: a direct SQL writer cannot exceed event capacity',
  { skip: config.storage !== 'postgres' },
  async () => {
    const app = await freshApp();
    const client = new pg.Client({ connectionString: config.databaseUrl });
    try {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await register(app);
        assert.equal(response.statusCode, 201);
        ids.push(response.json().id as string);
      }
      await client.connect();
      await assert.rejects(
        client.query(
          `INSERT INTO tickets
          (id, event_id, visitor_name, item_description, category, status, idempotency_key)
         VALUES ($1, $2, 'Direct writer', 'Broken kettle', 'appliances', 'queued', $3)`,
          [randomUUID(), EVENT_OPEN, 'direct-capacity-test'],
        ),
        (error: unknown) =>
          (error as { code?: string; constraint?: string }).code === '23514' &&
          (error as { constraint?: string }).constraint === 'events_active_capacity',
      );
      const before = await client.query<{ active_ticket_count: number }>(
        'SELECT active_ticket_count FROM events WHERE id = $1',
        [EVENT_OPEN],
      );
      assert.equal(before.rows[0]?.active_ticket_count, 5);

      assert.equal((await claim(app, ids[0]!, OLENA)).statusCode, 200);
      assert.equal((await complete(app, ids[0]!, OLENA, 'fixed')).statusCode, 200);
      const after = await client.query<{ active_ticket_count: number }>(
        'SELECT active_ticket_count FROM events WHERE id = $1',
        [EVENT_OPEN],
      );
      assert.equal(after.rows[0]?.active_ticket_count, 4);
    } finally {
      await client.end().catch(() => undefined);
      await app.close();
    }
  },
);

test(
  'I4: direct SQL rejects malformed idempotency keys',
  { skip: config.storage !== 'postgres' },
  async () => {
    const app = await freshApp();
    const client = new pg.Client({ connectionString: config.databaseUrl });
    try {
      await client.connect();
      await assert.rejects(
        client.query(
          `INSERT INTO tickets
          (id, event_id, visitor_name, item_description, category, status, idempotency_key)
         VALUES ($1, $2, 'Direct writer', 'Broken kettle', 'appliances', 'queued', $3)`,
          [randomUUID(), EVENT_OPEN, 'bad key'],
        ),
        (error: unknown) =>
          (error as { code?: string; constraint?: string }).code === '23514' &&
          (error as { constraint?: string }).constraint === 'tickets_idempotency_key_format',
      );
    } finally {
      await client.end().catch(() => undefined);
      await app.close();
    }
  },
);

test(
  'a committed registration replays after the event closes',
  { skip: config.storage !== 'postgres' },
  async () => {
    const app = await freshApp();
    const client = new pg.Client({ connectionString: config.databaseUrl });
    try {
      const idempotencyKey = key('closed-event');
      const original = await register(app, {}, idempotencyKey);
      assert.equal(original.statusCode, 201);
      await client.connect();
      await client.query("UPDATE events SET status = 'closed' WHERE id = $1", [EVENT_OPEN]);

      const replay = await register(app, {}, idempotencyKey);
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.json().id, original.json().id);
      assert.equal((await register(app, {}, key('new-after-close'))).statusCode, 409);
    } finally {
      await client.end().catch(() => undefined);
      await app.close();
    }
  },
);
