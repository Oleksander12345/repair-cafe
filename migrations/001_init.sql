-- 001: initial schema (spec.md §2).
CREATE TABLE events (
  id            uuid PRIMARY KEY,
  title         text        NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  ticket_limit  int         NOT NULL CHECK (ticket_limit > 0),
  status        text        NOT NULL CHECK (status IN ('planned', 'open', 'closed')),
  CHECK (ends_at > starts_at)
);

CREATE TABLE volunteers (
  id      uuid PRIMARY KEY,
  name    text   NOT NULL,
  skills  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE tickets (
  id                uuid PRIMARY KEY,
  event_id          uuid        NOT NULL REFERENCES events (id),
  volunteer_id      uuid        REFERENCES volunteers (id),
  visitor_name      text        NOT NULL CHECK (length(visitor_name) BETWEEN 1 AND 100),
  item_description  text        NOT NULL CHECK (length(item_description) BETWEEN 3 AND 500),
  category          text        NOT NULL,
  status            text        NOT NULL CHECK (status IN ('queued','in_repair','fixed','not_fixable','needs_parts','withdrawn')),
  idempotency_key   text        NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'in_repair') = (volunteer_id IS NOT NULL) OR status IN ('fixed','not_fixable'))
);
CREATE INDEX tickets_event_idx ON tickets (event_id, created_at);

CREATE TABLE ticket_transitions (
  id            bigserial PRIMARY KEY,
  ticket_id     uuid        NOT NULL REFERENCES tickets (id),
  from_status   text,
  to_status     text        NOT NULL,
  volunteer_id  uuid        REFERENCES volunteers (id),
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_transitions_ticket_idx ON ticket_transitions (ticket_id, id);
