import { RETRYABLE } from './pool.js';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const isTransient = (err: unknown) => RETRYABLE.has((err as { code?: string })?.code ?? '');

/**
 * Retry the complete transaction after a deadlock or serialization failure.
 * The prior attempt must have rolled back before the callback is repeated.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 20;
  const retryable = opts.isRetryable ?? isTransient;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !retryable(err)) throw err;
      await sleep(base * 2 ** (i - 1) + Math.random() * base); // Exponential backoff with jitter.
    }
  }
}
