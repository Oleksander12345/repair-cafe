import type { Id } from '../../shared/ids.js';

/** Одна сесія Repair Café: дата, місце, ліміт речей у черзі. */
export interface RepairEvent {
  id: Id;
  title: string;
  startsAt: Date;
  endsAt: Date;
  ticketLimit: number;
  status: 'planned' | 'open' | 'closed';
}
