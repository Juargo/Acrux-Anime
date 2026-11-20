-- The live-action dramas copied from TVmaze (ADR-0046): one row per show, keyed by its
-- TVmaze id, with its seasons and episodes as counts. TVmaze data is CC BY-SA 4.0, so it
-- lives in its own table, apart from the MyAnimeList catalog and from everything about a
-- user. A new table: no existing row is touched.
CREATE TABLE "drama" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" TEXT NOT NULL,
    "summary" TEXT,
    "cover_url" TEXT,
    "tvmaze_url" TEXT NOT NULL,
    "country" TEXT,
    "language" TEXT,
    "start_date" DATE,
    "year" INTEGER,
    "seasons" INTEGER,
    "episodes" INTEGER,
    "duration_minutes" INTEGER,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "imdb_id" TEXT,
    "thetvdb_id" INTEGER,
    "source_updated_at" TIMESTAMPTZ(6),
    "detailed_at" TIMESTAMPTZ(6),
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drama_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drama_weight_id_idx" ON "drama"("weight" DESC, "id");
CREATE INDEX "drama_year_idx" ON "drama"("year");

ALTER TABLE "drama" ENABLE ROW LEVEL SECURITY;

-- The API does not serve dramas yet: it only reads them (ADR-0028).
GRANT SELECT ON "drama" TO acrux_api;
CREATE POLICY "acrux_api_select" ON "drama" FOR SELECT TO acrux_api USING (true);

-- Role of the drama load job, which runs in GitHub Actions like the catalog one. It only
-- reaches this table. Like acrux_api it starts without login; production gives it a login
-- and a secret password outside the repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'acrux_dramas') THEN
    CREATE ROLE acrux_dramas NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO acrux_dramas;
-- No DELETE: the job never removes a drama, which a mark may point to later.
GRANT SELECT, INSERT, UPDATE ON "drama" TO acrux_dramas;
CREATE POLICY "acrux_dramas_all" ON "drama" TO acrux_dramas USING (true) WITH CHECK (true);
