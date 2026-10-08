import pg from 'pg';
import { UnavailableError } from '../../shared/errors.js';

/** SQLSTATE values for which a complete transaction retry is appropriate. */
export const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

/** Connection failures, database restarts, and timeouts indicate unavailable storage. */
function isUnavailable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (!e) return false;
  if (e.code && /^(08|57P0)/.test(e.code)) return true; // connection_exception, admin_shutdown
  if (e.code === '57014') return true; // query_canceled (statement_timeout)
  if (
    e.code &&
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'].includes(e.code)
  ) {
    return true;
  }
  return /timeout exceeded when trying to connect|Connection terminated/i.test(e.message ?? '');
}

export function toStorageError(err: unknown): unknown {
  return isUnavailable(err) ? new UnavailableError('Database unavailable', { cause: err }) : err;
}

/** Pool with a query counter for the board query-budget regression test. */
export class Db {
  readonly pool: pg.Pool;
  queries = 0;

  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 2_000,
      statement_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    // An idle-client error after a database restart must not crash the process.
    this.pool.on('error', () => undefined);
  }

  async query<R extends pg.QueryResultRow>(
    sql: string,
    params: unknown[] = [],
    client?: pg.PoolClient,
  ): Promise<pg.QueryResult<R>> {
    this.queries++;
    try {
      return await (client ?? this.pool).query<R>(sql, params);
    } catch (err) {
      throw toStorageError(err);
    }
  }

  async connect(): Promise<pg.PoolClient> {
    try {
      return await this.pool.connect();
    } catch (err) {
      throw toStorageError(err);
    }
  }

  async ping(): Promise<void> {
    await this.query('SELECT 1');
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
