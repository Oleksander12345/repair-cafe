import type { Id } from '../../shared/ids.js';
import type { Ticket, TicketStatus } from './domain.js';

export interface TicketRepository {
  findById(id: Id): Promise<Ticket | null>;
  findByIdempotencyKey(key: string): Promise<Ticket | null>;
  countActiveInEvent(eventId: Id): Promise<number>;
  findActiveByVolunteer(volunteerId: Id): Promise<Ticket | null>;
  insert(ticket: Ticket): Promise<void>;
  /** Оптимістичне оновлення: спрацьовує лише якщо поточний статус = expected. */
  updateStatus(
    id: Id,
    expected: TicketStatus,
    next: TicketStatus,
    volunteerId: Id | null,
  ): Promise<boolean>;
}
