-- Read-only role of the weekly backup (ADR-0022, ADR-0028, ADR-0032). Every table has RLS
-- and pg_dump refuses to run when RLS would hide rows, so the role needs BYPASSRLS. It
-- starts without login: production gives it a login and a secret password outside the
-- repository, and no other branch needs one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'acrux_backup') THEN
    CREATE ROLE acrux_backup NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT pg_read_all_data TO acrux_backup;
