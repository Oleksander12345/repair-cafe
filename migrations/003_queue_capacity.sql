-- Keep the event's active-ticket count authoritative even for direct SQL writers.
ALTER TABLE events
  ADD COLUMN active_ticket_count integer NOT NULL DEFAULT 0;

UPDATE events e
SET active_ticket_count = (
  SELECT count(*)::integer
  FROM tickets t
  WHERE t.event_id = e.id AND t.status IN ('queued', 'in_repair', 'needs_parts')
);

ALTER TABLE events
  ADD CONSTRAINT events_active_capacity
  CHECK (active_ticket_count >= 0 AND active_ticket_count <= ticket_limit);

CREATE FUNCTION update_event_active_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  was_active boolean;
  is_active boolean;
  delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('queued', 'in_repair', 'needs_parts') THEN
      UPDATE events SET active_ticket_count = active_ticket_count + 1 WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('queued', 'in_repair', 'needs_parts') THEN
      UPDATE events SET active_ticket_count = active_ticket_count - 1 WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.event_id <> NEW.event_id THEN
    RAISE EXCEPTION 'A ticket cannot move to another event'
      USING ERRCODE = '23514', CONSTRAINT = 'tickets_event_immutable';
  END IF;
  was_active := OLD.status IN ('queued', 'in_repair', 'needs_parts');
  is_active := NEW.status IN ('queued', 'in_repair', 'needs_parts');
  delta := is_active::integer - was_active::integer;
  IF delta <> 0 THEN
    UPDATE events SET active_ticket_count = active_ticket_count + delta WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_active_count
AFTER INSERT OR UPDATE OR DELETE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_event_active_count();
