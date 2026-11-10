-- The stored anime ids become MyAnimeList ids (ADR-0043, point 6): from here on the
-- catalog, the marks and the curator table all use the same id.
--
-- Nothing is lost in silence: what cannot be converted is moved to a table kept aside.
-- Checked on 2026-11-10: production holds no marks and no curator rows.

-- The curator table holds AniList ids only, with no MyAnimeList id to convert them with.
CREATE TABLE "franchise_override_anilist" (
    "anilist_id" INTEGER NOT NULL,
    "franchise_root_id" INTEGER NOT NULL,
    "role" "franchise_role" NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "franchise_override_anilist_pkey" PRIMARY KEY ("anilist_id")
);

INSERT INTO "franchise_override_anilist" ("anilist_id", "franchise_root_id", "role", "updated_at")
SELECT "anime_id", "franchise_root_id", "role", "updated_at" FROM "franchise_override";

DELETE FROM "franchise_override";

-- Marks that cannot be converted. They belong to the user: deleting the account deletes
-- them too.
CREATE TABLE "mark_anilist" (
    "user_id" UUID NOT NULL,
    "anilist_id" INTEGER NOT NULL,
    "mal_id" INTEGER,
    "status" "mark_status" NOT NULL,
    "marked_at" TIMESTAMPTZ(6) NOT NULL,
    -- no_mal_id: AniList never told the MyAnimeList id. duplicate: another mark of the
    -- same user already stands for that MyAnimeList anime.
    "reason" TEXT NOT NULL,

    CONSTRAINT "mark_anilist_pkey" PRIMARY KEY ("user_id", "anilist_id"),
    CONSTRAINT "mark_anilist_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

WITH moved AS (
    DELETE FROM "mark" WHERE "mal_id" IS NULL RETURNING *
)
INSERT INTO "mark_anilist" ("user_id", "anilist_id", "mal_id", "status", "marked_at", "reason")
SELECT "user_id", "anime_id", "mal_id", "status", "marked_at", 'no_mal_id' FROM moved;

-- Two AniList entries of one MyAnimeList anime: the seen one stays, then the oldest.
WITH ranked AS (
    SELECT "user_id", "anime_id",
        row_number() OVER (
            PARTITION BY "user_id", "mal_id"
            ORDER BY ("status" = 'seen') DESC, "marked_at", "anime_id"
        ) AS position
    FROM "mark"
), moved AS (
    DELETE FROM "mark" AS m USING ranked AS r
    WHERE m."user_id" = r."user_id" AND m."anime_id" = r."anime_id" AND r.position > 1
    RETURNING m.*
)
INSERT INTO "mark_anilist" ("user_id", "anilist_id", "mal_id", "status", "marked_at", "reason")
SELECT "user_id", "anime_id", "mal_id", "status", "marked_at", 'duplicate' FROM moved;

-- The key is dropped during the update: the new id of one row can be the old id of another.
ALTER TABLE "mark" DROP CONSTRAINT "mark_pkey";
UPDATE "mark" SET "anime_id" = "mal_id";
ALTER TABLE "mark" DROP COLUMN "mal_id";
ALTER TABLE "mark" ADD CONSTRAINT "mark_pkey" PRIMARY KEY ("user_id", "anime_id");

-- RLS like every table of public (ADR-0028). No grants: the API never reads these tables;
-- the owner and the backup role do.
ALTER TABLE "franchise_override_anilist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mark_anilist" ENABLE ROW LEVEL SECURITY;
