import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { SEED_EVENTS, SEED_VOLUNTEERS } from '../src/adapters/seed-data.js';

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Never let scenario tests reset a pre-existing or non-local database. */
export function assertIsolatedTestDatabase(url: string | undefined): string {
  if (!url) throw new Error('TEST_DATABASE_URL is required for PostgreSQL tests');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  const dbName = decodeURIComponent(parsed.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !parsed.port ||
    parsed.port === '5432' ||
    !/^repair_cafe_lab2_test_[a-z0-9_]+$/.test(dbName)
  ) {
    throw new Error(
      'PostgreSQL tests require a dedicated local test database on a non-default port',
    );
  }
  return url;
}

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: assertIsolatedTestDatabase(url) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function migrateTestDatabase(url: string): Promise<void> {
  await withClient(url, async (client) => {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (row) => row.name,
      ),
    );
    for (const name of (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort()) {
      if (done.has(name)) continue;
      const sql = await readFile(
        fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)),
        'utf8',
      );
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  });
}

/** Reset only the explicitly named ephemeral test database, then seed known fixtures. */
export async function resetTestDatabase(url: string): Promise<void> {
  await migrateTestDatabase(url);
  await withClient(url, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        'TRUNCATE ticket_transitions, tickets, volunteers, events RESTART IDENTITY',
      );
      for (const event of SEED_EVENTS) {
        await client.query(
          'INSERT INTO events (id, title, starts_at, ends_at, ticket_limit, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [event.id, event.title, event.startsAt, event.endsAt, event.ticketLimit, event.status],
        );
      }
      for (const volunteer of SEED_VOLUNTEERS) {
        await client.query('INSERT INTO volunteers (id, name, skills) VALUES ($1, $2, $3)', [
          volunteer.id,
          volunteer.name,
          volunteer.skills,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
