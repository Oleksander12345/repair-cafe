import type pg from 'pg';
import type { EventRepository, RepairEvent } from '../../modules/events/index.js';
import type {
  Ticket,
  TicketStore,
  TicketTransition,
  TicketTx,
} from '../../modules/tickets/index.js';
import type { Volunteer, VolunteerRepository } from '../../modules/volunteers/index.js';
import type { Category } from '../../shared/categories.js';
import { DomainError } from '../../shared/errors.js';
import { Db } from './pool.js';
import { withRetry } from './retry.js';

export interface PostgresStorage {
  db: Db;
  events: EventRepository;
  volunteers: VolunteerRepository;
  tickets: TicketStore;
}

type Row = Record<string, unknown>;

const toEvent = (r: Row): RepairEvent => ({
  id: r.id as string,
  title: r.title as string,
  startsAt: r.starts_at as Date,
  endsAt: r.ends_at as Date,
  ticketLimit: r.ticket_limit as number,
  status: r.status as RepairEvent['status'],
});
const toVolunteer = (r: Row): Volunteer => ({
  id: r.id as string,
  name: r.name as string,
  skills: r.skills as Category[],
});
const toTicket = (r: Row): Ticket => ({
  id: r.id as string,
  eventId: r.event_id as string,
  visitorName: r.visitor_name as string,
  itemDescription: r.item_description as string,
  category: r.category as Category,
  status: r.status as Ticket['status'],
  volunteerId: (r.volunteer_id as string | null) ?? null,
  idempotencyKey: r.idempotency_key as string,
  createdAt: r.created_at as Date,
});
const toTransition = (r: Row): TicketTransition => ({
  ticketId: r.ticket_id as string,
  fromStatus: (r.from_status as Ticket['status'] | null) ?? null,
  toStatus: r.to_status as Ticket['status'],
  volunteerId: (r.volunteer_id as string | null) ?? null,
  at: r.at as Date,
});

const TICKET_COLS =
  'id, event_id, volunteer_id, visitor_name, item_description, category, status, idempotency_key, created_at';

function txOps(db: Db, c: pg.PoolClient): TicketTx {
  return {
    async findById(id) {
      const { rows } = await db.query(
        `SELECT ${TICKET_COLS} FROM tickets WHERE id = $1 FOR UPDATE`,
        [id],
        c,
      );
      return rows[0] ? toTicket(rows[0]) : null;
    },
    async lockEventForRegistration(eventId) {
      await db.query('SELECT 1 FROM events WHERE id = $1 FOR UPDATE', [eventId], c);
    },
    async findByIdempotencyKey(key) {
      const { rows } = await db.query(
        `SELECT ${TICKET_COLS} FROM tickets WHERE idempotency_key = $1`,
        [key],
        c,
      );
      return rows[0] ? toTicket(rows[0]) : null;
    },
    async countActiveInEvent(eventId) {
      const { rows } = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM tickets
          WHERE event_id = $1 AND status IN ('queued','in_repair','needs_parts')`,
        [eventId],
        c,
      );
      return rows[0]?.n ?? 0;
    },
    async findInRepairByVolunteer(volunteerId) {
      const { rows } = await db.query(
        `SELECT ${TICKET_COLS} FROM tickets WHERE volunteer_id = $1 AND status = 'in_repair'`,
        [volunteerId],
        c,
      );
      return rows[0] ? toTicket(rows[0]) : null;
    },
    async insert(t) {
      const { rowCount } = await db.query(
        `INSERT INTO tickets (${TICKET_COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          t.id,
          t.eventId,
          t.volunteerId,
          t.visitorName,
          t.itemDescription,
          t.category,
          t.status,
          t.idempotencyKey,
          t.createdAt,
        ],
        c,
      );
      return rowCount === 1 ? 'inserted' : 'duplicate';
    },
    async save(t) {
      try {
        await db.query(
          'UPDATE tickets SET status = $2, volunteer_id = $3 WHERE id = $1',
          [t.id, t.status, t.volunteerId],
          c,
        );
      } catch (err) {
        const e = err as { code?: string; constraint?: string };
        if (e.code === '23505' && e.constraint === 'tickets_one_in_repair_per_volunteer') {
          throw new DomainError(
            'CONFLICT',
            'Volunteer already has an item in repair',
            'VOLUNTEER_BUSY',
          );
        }
        throw err;
      }
    },
    async addTransition(t) {
      await db.query(
        `INSERT INTO ticket_transitions (ticket_id, from_status, to_status, volunteer_id, at)
         VALUES ($1,$2,$3,$4,$5)`,
        [t.ticketId, t.fromStatus, t.toStatus, t.volunteerId, t.at],
        c,
      );
    },
  };
}

export function createPostgresStorage(url: string): PostgresStorage {
  const db = new Db(url);
  return {
    db,
    events: {
      async findById(id) {
        const { rows } = await db.query('SELECT * FROM events WHERE id = $1', [id]);
        return rows[0] ? toEvent(rows[0]) : null;
      },
      async list() {
        return (await db.query('SELECT * FROM events ORDER BY starts_at DESC')).rows.map(toEvent);
      },
    },
    volunteers: {
      async findById(id) {
        const { rows } = await db.query('SELECT * FROM volunteers WHERE id = $1', [id]);
        return rows[0] ? toVolunteer(rows[0]) : null;
      },
      async list() {
        return (await db.query('SELECT * FROM volunteers ORDER BY name')).rows.map(toVolunteer);
      },
    },
    tickets: {
      transaction: (fn) =>
        withRetry(async () => {
          const c = await db.connect();
          try {
            await db.query('BEGIN', [], c);
            const result = await fn(txOps(db, c));
            await db.query('COMMIT', [], c);
            return result;
          } catch (err) {
            await c.query('ROLLBACK').catch(() => undefined);
            throw err;
          } finally {
            c.release();
          }
        }),
      async findById(id) {
        const { rows } = await db.query(`SELECT ${TICKET_COLS} FROM tickets WHERE id = $1`, [id]);
        return rows[0] ? toTicket(rows[0]) : null;
      },
      async listQueue(eventId) {
        const cols = TICKET_COLS.split(', ')
          .map((col) => `t.${col}`)
          .join(', ');
        const { rows } = await db.query(
          `SELECT ${cols}, v.name AS volunteer_name
             FROM tickets t
             LEFT JOIN volunteers v ON v.id = t.volunteer_id
            WHERE t.event_id = $1
            ORDER BY t.created_at, t.id`,
          [eventId],
        );
        return rows.map((r) => ({
          ticket: toTicket(r),
          volunteerName: (r.volunteer_name as string | null) ?? null,
        }));
      },
      async history(ticketId) {
        const { rows } = await db.query(
          'SELECT * FROM ticket_transitions WHERE ticket_id = $1 ORDER BY id',
          [ticketId],
        );
        return rows.map(toTransition);
      },
    },
  };
}
