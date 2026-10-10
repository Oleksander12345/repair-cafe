// Public ticket module API.
export type {
  Outcome,
  RegistrationInput,
  Ticket,
  TicketStatus,
  TicketTransition,
} from './domain.js';
export {
  ACTIVE_STATUSES,
  OUTCOMES,
  TRANSITIONS,
  assertTransition,
  canRepair,
  canTransition,
  isSameRegistration,
  validateRegistration,
} from './domain.js';
export type { QueueItem, TicketStore, TicketTx } from './ports.js';
export type { RegisterTicketCommand, TicketService } from './service.js';
export { createTicketService } from './service.js';
