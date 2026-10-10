# 0005. Row locks, constraints and whole-transaction retries

- Status: accepted for Lab 2 implementation
- Date: 2026-10-09

## Context

Two registrations can both see free capacity; two volunteers can claim one ticket; one
volunteer can claim two tickets; and two requests can reuse one idempotency key. Wrapping
each request in a transaction alone does not prevent these schedules under READ COMMITTED.

## Decision

Use PostgreSQL READ COMMITTED with explicit serialization points and durable constraints:

1. Registration checks the global idempotency key, then locks the event row before reading
   its status and capacity. `tickets.idempotency_key` is UNIQUE. A trigger maintains
   `events.active_ticket_count`; its CHECK prevents direct SQL writers from exceeding the
   event limit.
2. Claim locks the ticket and then the volunteer, checks skills and current assignments,
   and writes the ticket and transition in one transaction. One `volunteer_id` field means
   one assignee per ticket; a partial UNIQUE index prevents two `in_repair` tickets for
   one volunteer even if another writer omits the lock protocol.
3. Completion locks the ticket, checks the assignee and transition, and atomically updates
   the ticket plus history. A terminal outcome decrements the event counter through the
   trigger; `needs_parts` remains active but frees the volunteer.
4. Retry the _entire_ transaction at most three times for SQLSTATE `40P01` or `40001`,
   with bounded exponential backoff and jitter. Do not retry validation or conflict errors.

## Alternatives and trade-offs

SERIALIZABLE plus retry could enforce predicate checks but would cause more retry work for
the expected small event queues. Optimistic versions on individual tickets cannot alone
protect an event-wide capacity count. Advisory locks add a hidden key protocol. Event-row
locks serialize registrations to one event; that is acceptable for this exercise but must
be measured if throughput becomes important. A 503 after connection loss can mean a commit
outcome is unknown: registration is safely reconciled with the same Idempotency-Key, while
claim/complete clients should first read the ticket before deciding to retry.

## Verification and recovery

Memory tests exercise the shared service contract, not PostgreSQL locking. Real PG tests
must run against an isolated temporary database and check races, direct SQL constraints,
deadlock retry, and the board query budget. A failed transaction rolls back ticket and
history together; an unknown COMMIT result must be reconciled by reading state rather
than assuming rollback.
