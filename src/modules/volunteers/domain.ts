import type { Category } from '../../shared/categories.js';
import type { Id } from '../../shared/ids.js';

/** Майстер-волонтер і категорії речей, які він уміє лагодити. */
export interface Volunteer {
  id: Id;
  name: string;
  skills: Category[];
}
