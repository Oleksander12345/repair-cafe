-- Enforce the same opaque key format for direct SQL writers.
ALTER TABLE tickets
  ADD CONSTRAINT tickets_idempotency_key_format
  CHECK (idempotency_key ~ '^[!-~]{8,100}$');
