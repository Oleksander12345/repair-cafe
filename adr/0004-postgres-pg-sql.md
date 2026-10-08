# 0004. PostgreSQL with `pg` and explicit SQL

- Status: accepted for Lab 2 implementation
- Date: 2026-10-09

## Context

Tickets belong to events and may have one volunteer and many transitions. Registration,
claiming and completion must preserve cross-row invariants under concurrent requests. The
assignment requires PostgreSQL through `pg` without an ORM and asks for observable SQL cost.

## Decision

Use PostgreSQL as the durable store and `pg` with parameterized SQL in
`src/adapters/postgres`. The services depend on the same ports for memory and PostgreSQL.
Schema changes are ordered SQL files in `migrations/`; tests may apply them only to a
dedicated temporary database. Application startup does not silently migrate a database.

## Alternatives

- In-memory storage is useful for a fast prototype, but is lost on restart and cannot prove
  multi-process concurrency.
- SQLite is simpler to run but does not provide PostgreSQL's row-locking semantics needed
  for this exercise.
- An ORM would reduce manual row mapping, but would obscure the explicit lock and query
  strategy requested here; it remains a later option if mapping cost becomes material.

## Consequences

The adapter owns SQL, row mapping, transaction lifetime and pool cleanup. The board uses a
joined read model rather than per-ticket lookups. Parameterized SQL protects values from
injection; it does not replace request validation. Manual mappings and SQL migrations need
tests against a real PostgreSQL instance. Applying these files to a pre-existing database
requires checking current schema and data first; this work does not do that. Roll-forward
is preferred for an applied migration, and restoring a previous database state would need
an operator-managed backup.
