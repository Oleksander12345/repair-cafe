# Lab 2 audit: three cut corners and their separate fixes

The initial Lab 2 adapter was committed as `442259f` after the in-memory prototype
`68bf2a3`. It came from the user-provided `history-kit 2.zip` snapshot and was reviewed
against the current Lab 1 code; the archive's historical report files were **not** treated
as results from this run. The evidence below distinguishes source inspection from tests
actually executed on this machine.

## 1. Event state and volunteer skills were read outside the transaction

**Before (`442259f`):** `tickets.register` called `events.getOpenEvent` before
`store.transaction`, and `tickets.claim` called `volunteers.getVolunteer` before it. A
concurrent close or skill change could make the later ticket write rely on stale state.
Also, a legitimate replay after event closure was rejected before the stored key was
checked. This is direct code evidence, not a measured PostgreSQL race.

**Fix (`7b92c00`):** `TicketTx.lockEventForRegistration` and
`lockVolunteerForClaim` now return the locked, current rows; decisions run inside the
transaction. A key already stored is checked first, so the same request can replay after
closure. `test/service-regressions.test.ts` demonstrates that replay and rejects a new
registration to the closed event. The memory test passed; the database interleaving
still needs a real PG run.

An additional PostgreSQL case in `test/db-invariants.test.ts` is prepared to close the
event with SQL after the first registration and verify a 200 replay but 409 for a new
key; it has not yet been run against a live database.

## 2. Capacity depended on every writer following the application lock protocol

**Before (`442259f`):** registration locked `events` and counted active tickets, but
`migrations/001_init.sql` and `002_invariants.sql` had no constraint on the event-wide
count. A direct SQL insert could exceed `ticket_limit` while every application test
remained green. The missing constraint is visible in those SQL files.

**Fix (`19bf9d8`):** `003_queue_capacity.sql` adds an active-ticket counter, a CHECK
against the limit, and a trigger for inserts, status changes and deletes. The adapter
maps the capacity constraint to `409 QUEUE_FULL`. `test/db-invariants.test.ts` attempts
a direct sixth insert at a limit of five and checks that terminal completion releases
one slot. The SQL test is prepared but has not been run on PostgreSQL yet.

## 3. The idempotency key format was enforced only at the HTTP edge

**Before (`442259f`):** the route had length checks, but direct service calls and SQL
writers accepted empty or whitespace keys. This made the key contract inconsistent
across the two adapters and allowed unusable operation identities.

**Fix (`498d1cb`):** HTTP schema, shared service validation and SQL CHECK now agree
on 8–100 printable non-space ASCII characters. Memory regressions for malformed keys
pass. The direct-SQL rejection test is in `test/db-invariants.test.ts` and awaits a
real PG run. The existing UNIQUE constraint and body comparison continue to reject
same-key/different-body replays.

## Other required checks

- The same S1–S10 and C1–C5 tests run through both adapters via `test/helpers.ts`;
  the in-memory run passed 21/21 after the three fixes. A memory mutex alone does not
  prove PostgreSQL race safety.
- `test/query-budget.test.ts` checks that the board uses at most two client SQL calls
  for 1 and 15 tickets. The adapter uses one joined ticket/volunteer query plus one
  event lookup; this is code evidence until the PostgreSQL test runs.
- `test/failures.test.ts` passed F1–F3 against a deliberately unreachable loopback
  port: liveness stayed 200, readiness and operations returned 503, and write errors
  included `Retry-After: 5` without leaking the connection address. This is a failed
  connection test, not a live PostgreSQL restart. `test/retry.test.ts` passed the
  bounded retry cases.
- `test:db` refuses to start without `TEST_DATABASE_URL` for a dedicated loopback
  database on a non-default port. The negative guard test passed; no schema was
  applied to the existing `localhost:5432` server.

The live PostgreSQL results, any failed attempts, and exact runtime should be appended
here after an authorized isolated test run. Do not substitute the supplied archive's
report numbers for fresh evidence.

## Isolated PostgreSQL verification — 2026-10-09

The preceding pending notes describe the state before the authorized database run.
On Node.js 22.22.1 and PostgreSQL 18, an `initdb` cluster was started under the
repository's temporary `.lab2-test-runtime/pg-cluster-20261009` directory, bound to
`127.0.0.1:55432`. The fixture applied migrations only to
`repair_cafe_lab2_test_20261009`; `SHOW data_directory` confirmed the intended
cluster before the run. The existing server on port 5432 was not used.

`npm.cmd run test:db` passed **25/25** tests: S1–S10, C1–C5, three direct-SQL
invariant/replay tests, F1–F3, Q1, and R1–R3. Thus the direct sixth insert was
rejected by the database, malformed keys were rejected by SQL, and replay after
event closure worked. Q1 passed the at-most-two-client-query budget for both 1
and 15 tickets. The five C-series races then passed in **five additional runs**
(25/25 repeated race cases). These results supersede the earlier pending
PostgreSQL statements above; there were no failed attempts in this run.

Limits of evidence: F1–F3 use an unreachable loopback port, not a stopped and
restarted live server. R1–R3 inject PostgreSQL error codes into the retry wrapper;
they do not create a real database deadlock. Q1 counts application-issued queries,
not server-side statements from triggers. The run does not prove behavior under
production load or a real identity/authorization scheme.

After verification, the isolated server was stopped; its exact temporary
cluster, log, and empty parent directory were removed. This disposable test
data has no backup and is not recoverable. No existing PostgreSQL cluster or
database was removed.
