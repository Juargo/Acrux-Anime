-- The catalog copied from MyAnimeList (ADR-0043): one row per anime, keyed by its
-- MyAnimeList id, so the API serves browsing, filters and franchises without calling the
-- source. It holds nothing about a user. A new table: no existing row is touched.
CREATE TABLE "anime" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "title_english" TEXT,
    "title_japanese" TEXT,
    "search_text" TEXT NOT NULL,
    "cover_url" TEXT,
    "format" TEXT,
    "start_date" DATE,
    "year" INTEGER,
    "episodes" INTEGER,
    "duration_minutes" INTEGER,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "members" INTEGER NOT NULL DEFAULT 0,
    "adult" BOOLEAN NOT NULL DEFAULT false,
    "relations" JSONB NOT NULL DEFAULT '[]',
    "detailed_at" TIMESTAMPTZ(6),
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anime_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "anime_members_id_idx" ON "anime"("members" DESC, "id");
CREATE INDEX "anime_year_idx" ON "anime"("year");

-- Same rules as every other table (ADR-0028): only acrux_api has grants and a policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "anime" TO acrux_api;
ALTER TABLE "anime" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acrux_api_all" ON "anime" TO acrux_api USING (true) WITH CHECK (true);
