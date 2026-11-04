-- Public profile (#37): the @handle of the link, the owner's last counter and the first
-- card shared. Every column is nullable, so existing profiles stay valid; their handle is
-- assigned on their next request.
ALTER TABLE "profile"
  ADD COLUMN "handle" VARCHAR(20),
  ADD COLUMN "shown_total" INTEGER,
  ADD COLUMN "shown_mode" "counter_mode",
  ADD COLUMN "card_shared_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "profile_handle_key" ON "profile"("handle");

-- The same rules as the API (modules/profile/services/handle.ts), enforced by the database.
ALTER TABLE "profile"
  ADD CONSTRAINT "profile_handle_format" CHECK ("handle" ~ '^[a-z0-9_]{3,20}$'),
  ADD CONSTRAINT "profile_shown_total_range" CHECK ("shown_total" >= 0);
