export type DomainErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT';

/** Domain failure independent of HTTP; mapped in platform/http/errors.ts. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Storage is unavailable; clients may retry later. */
export class UnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UnavailableError';
  }
}
