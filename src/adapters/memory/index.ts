import type { RepairEvent, EventRepository } from '../../modules/events/index.js';
import type {
  Ticket,
  TicketStore,
  TicketTransition,
  TicketTx,
} from '../../modules/tickets/index.js';
import { ACTIVE_STATUSES } from '../../modules/tickets/index.js';
import type { Volunteer, VolunteerRepository } from '../../modules/volunteers/index.js';
import { DomainError } from '../../shared/errors.js';
import { SEED_EVENTS, SEED_VOLUNTEERS } from '../seed-data.js';

/** Prototype storage backed by process memory. */
export interface MemoryStorage {
  events: EventRepository;
  volunteers: VolunteerRepository;
  tickets: TicketStore;
}

export function createMemoryStorage(): MemoryStorage {
  const events = new Map<string, RepairEvent>(SEED_EVENTS.map((e) => [e.id, { ...e }]));
  const volunteers = new Map<string, Volunteer>(SEED_VOLUNTEERS.map((v) => [v.id, { ...v }]));
  let tickets = new Map<string, Ticket>();
  let transitions: TicketTransition[] = [];

  // Serialize transactions so concurrent calls cannot violate in-memory invariants.
  let queue: Promise<unknown> = Promise.resolve();

  const tx: TicketTx = {
    findById: async (id) => tickets.get(id) ?? null,
    findByIdempotencyKey: async (key) =>
      [...tickets.values()].find((t) => t.idempotencyKey === key) ?? null,
    countActiveInEvent: async (eventId) =>
      [...tickets.values()].filter(
        (t) => t.eventId === eventId && ACTIVE_STATUSES.includes(t.status),
      ).length,
    findInRepairByVolunteer: async (volunteerId) =>
      [...tickets.values()].find(
        (t) => t.volunteerId === volunteerId && t.status === 'in_repair',
      ) ?? null,
    lockEventForRegistration: async () => undefined, // Transactions are already serialized.
    async insert(t) {
      if ([...tickets.values()].some((x) => x.idempotencyKey === t.idempotencyKey))
        return 'duplicate';
      tickets.set(t.id, { ...t });
      return 'inserted';
    },
    async save(t) {
      const clash = [...tickets.values()].some(
        (x) =>
          x.id !== t.id &&
          t.status === 'in_repair' &&
          x.status === 'in_repair' &&
          x.volunteerId === t.volunteerId,
      );
      if (clash)
        throw new DomainError(
          'CONFLICT',
          'Volunteer already has an item in repair',
          'VOLUNTEER_BUSY',
        );
      tickets.set(t.id, { ...t });
    },
    addTransition: async (t) => void transitions.push({ ...t }),
  };

  return {
    events: {
      findById: async (id) => events.get(id) ?? null,
      list: async () => [...events.values()],
    },
    volunteers: {
      findById: async (id) => volunteers.get(id) ?? null,
      list: async () => [...volunteers.values()],
    },
    tickets: {
      transaction<T>(fn: (t: TicketTx) => Promise<T>): Promise<T> {
        const run = async () => {
          const snapshot = { tickets: new Map(tickets), transitions: [...transitions] };
          try {
            return await fn(tx);
          } catch (err) {
            tickets = snapshot.tickets; // rollback
            transitions = snapshot.transitions;
            throw err;
          }
        };
        const result = queue.then(run, run);
        queue = result.catch(() => undefined);
        return result;
      },
      findById: async (id) => tickets.get(id) ?? null,
      listQueue: async (eventId) =>
        [...tickets.values()]
          .filter((t) => t.eventId === eventId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((ticket) => ({
            ticket,
            volunteerName: ticket.volunteerId
              ? (volunteers.get(ticket.volunteerId)?.name ?? null)
              : null,
          })),
      history: async (id) => transitions.filter((t) => t.ticketId === id),
    },
  };
}
