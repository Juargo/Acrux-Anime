-- Card themes (RF-52): Clásica is free and Neón needs Plus. Existing profiles keep Clásica.
-- Only adds a type and a column with a default; no existing data changes.
CREATE TYPE "card_theme" AS ENUM ('clasica', 'neon');

ALTER TABLE "profile" ADD COLUMN "card_theme" "card_theme" NOT NULL DEFAULT 'clasica';
