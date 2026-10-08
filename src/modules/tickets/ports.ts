import type { Id } from '../../shared/ids.js';
import type { Ticket, TicketStatus, TicketTransition } from './domain.js';

/** Operations available within one transaction. */
export interface TicketTx {
  /** Read and lock a ticket until transaction end. */
  findById(id: Id): Promise<Ticket | null>;
  findByIdempotencyKey(key: string): Promise<Ticket | null>;
  /** Serialize registrations to one event. */
  lockEventForRegistration(eventId: Id): Promise<void>;
  countActiveInEvent(eventId: Id): Promise<number>;
  findInRepairByVolunteer(volunteerId: Id): Promise<Ticket | null>;
  /** 'duplicate' means another transaction inserted this idempotency key. */
  insert(ticket: Ticket): Promise<'inserted' | 'duplicate'>;
  /** Throw VOLUNTEER_BUSY when the durable uniqueness rule rejects the write. */
  save(ticket: Ticket): Promise<void>;
  addTransition(t: TicketTransition): Promise<void>;
}

/** Board read model: ticket and volunteer name without per-ticket queries. */
export interface QueueItem {
  ticket: Ticket;
  volunteerName: string | null;
}

export interface TicketStore {
  /** Run fn atomically: commit all changes or none. */
  transaction<T>(fn: (tx: TicketTx) => Promise<T>): Promise<T>;
  findById(id: Id): Promise<Ticket | null>;
  listQueue(eventId: Id): Promise<QueueItem[]>;
  history(ticketId: Id): Promise<TicketTransition[]>;
}

export type { TicketStatus };
