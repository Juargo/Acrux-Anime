-- Role of the catalog load job (ADR-0043, point 3). The job runs in GitHub Actions, so its
-- secret lives outside Vercel: it only reaches the catalog table and cannot read or change
-- anything about a user. Like acrux_api it starts without login; production gives it a
-- login and a secret password outside the repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'acrux_catalog') THEN
    CREATE ROLE acrux_catalog NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO acrux_catalog;
-- No DELETE: the job never removes an anime, which a mark may point to.
GRANT SELECT, INSERT, UPDATE ON "anime" TO acrux_catalog;
CREATE POLICY "acrux_catalog_all" ON "anime" TO acrux_catalog USING (true) WITH CHECK (true);
