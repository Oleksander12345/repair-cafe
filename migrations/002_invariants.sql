-- 002: enforce I2 at the database boundary.
-- One volunteer cannot hold two in_repair tickets even when concurrent checks both pass.
CREATE UNIQUE INDEX tickets_one_in_repair_per_volunteer
  ON tickets (volunteer_id)
  WHERE status = 'in_repair';
