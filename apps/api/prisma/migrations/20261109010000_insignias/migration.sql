-- Badges earned by milestones (RF-55, epic #50): the ids the browser computed from the seen
-- titles, validated by the API against its catalog. A new column with a constant default:
-- existing rows get an empty list and no row is rewritten (PostgreSQL 11+).
ALTER TABLE "profile" ADD COLUMN "badges" TEXT[] NOT NULL DEFAULT '{}';
