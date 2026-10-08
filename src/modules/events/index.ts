// Публічний API модуля events. Інші модулі імпортують ЛИШЕ звідси.
export type { RepairEvent } from './domain.js';
export type { EventRepository } from './ports.js';
export type { EventService } from './service.js';
export { createEventService } from './service.js';
