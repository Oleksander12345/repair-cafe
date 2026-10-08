import type { Category } from '../../shared/categories.js';
import { DomainError } from '../../shared/errors.js';
import type { Id } from '../../shared/ids.js';

/**
 * Життєвий цикл речі на ремонті:
 * queued → in_repair → fixed | not_fixable | needs_parts;  needs_parts → queued (принесли деталь)
 * queued → withdrawn (власник забрав без ремонту)
 */
export type TicketStatus =
  'queued' | 'in_repair' | 'fixed' | 'not_fixable' | 'needs_parts' | 'withdrawn';

export const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  queued: ['in_repair', 'withdrawn'],
  in_repair: ['fixed', 'not_fixable', 'needs_parts'],
  needs_parts: ['queued', 'withdrawn'],
  fixed: [],
  not_fixable: [],
  withdrawn: [],
};

export interface Ticket {
  id: Id;
  eventId: Id;
  visitorName: string;
  itemDescription: string;
  category: Category;
  status: TicketStatus;
  volunteerId: Id | null;
  idempotencyKey: string;
  createdAt: Date;
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('CONFLICT', `Illegal transition ${from} -> ${to}`);
  }
}

/** Майстер може взяти річ, лише якщо вміє лагодити її категорію. */
export function canRepair(skills: readonly Category[], category: Category): boolean {
  return skills.includes(category);
}
