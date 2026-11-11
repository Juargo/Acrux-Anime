-- The id of an anime stops being named after AniList (ADR-0043, point 6). A rename only:
-- the values stay as they are and no row is rewritten.
ALTER TABLE "mark" RENAME COLUMN "anilist_id" TO "anime_id";
ALTER TABLE "franchise_override" RENAME COLUMN "anilist_id" TO "anime_id";
