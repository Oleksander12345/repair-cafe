// Публічний API модуля tickets.
export type { Ticket, TicketStatus } from './domain.js';
export { TRANSITIONS, canTransition, assertTransition, canRepair } from './domain.js';
export type { TicketRepository } from './ports.js';
export type { RegisterTicketCommand } from './service.js';
export { createTicketService } from './service.js';
