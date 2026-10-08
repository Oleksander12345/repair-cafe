// Public event module API; other modules import only from here.
export type { RepairEvent } from './domain.js';
export type { EventRepository } from './ports.js';
export type { EventService } from './service.js';
export { createEventService } from './service.js';
