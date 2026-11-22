-- The openings of each anime, read with its detail from the opening_themes field of
-- MyAnimeList: [{ title, artist, episodes }] in the order they aired. Null means the detail
-- was last read before this column existed; the load job and the fill on demand replace it.
-- Expand only (ADR-0022): one nullable column, which acrux_catalog already writes through
-- its grant on the table.
ALTER TABLE "anime" ADD COLUMN "openings" JSONB;
