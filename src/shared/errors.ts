export type DomainErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT';

/** Помилка предметної області. Не знає про HTTP — мапінг у platform/http/errors.ts. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
