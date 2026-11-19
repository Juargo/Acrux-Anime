-- The franchise of each anime, stored so the catalog can filter and count by the year a
-- franchise first released (ADR-0045). The recompute step of the catalog load job
-- fills both columns from the grouping of @acrux/domain; until then they are null and nothing
-- reads them. Expand only (ADR-0022): two nullable columns and an index.
ALTER TABLE "anime" ADD COLUMN "franchise_root_id" INTEGER;
ALTER TABLE "anime" ADD COLUMN "franchise_year" INTEGER;

CREATE INDEX "anime_franchise_year_idx" ON "anime"("franchise_year");

-- The recompute step runs as acrux_catalog (rol_de_catalogo): it also reads the curator
-- table, which it could not until now. Read only; RLS is already on and has no policy for it.
GRANT SELECT ON "franchise_override" TO acrux_catalog;
CREATE POLICY "acrux_catalog_read" ON "franchise_override" FOR SELECT TO acrux_catalog USING (true);
