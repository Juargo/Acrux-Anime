-- The language of the account (#43): null follows the browser language.
-- Existing profiles got "es" from the old default, not from a choice, so they go back to null.
ALTER TABLE "profile" ALTER COLUMN "locale" DROP DEFAULT;
ALTER TABLE "profile" ALTER COLUMN "locale" DROP NOT NULL;
UPDATE "profile" SET "locale" = NULL;
