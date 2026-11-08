-- Lifetime Plus with Lemon Squeezy (epic #50).
-- ADR-0036 retired the annual plan. No purchase has ever been possible, so no row holds it.
ALTER TYPE "plan" RENAME TO "plan_old";
CREATE TYPE "plan" AS ENUM ('plus_lifetime');
ALTER TABLE "entitlement" ALTER COLUMN "plan" TYPE "plan" USING ("plan"::text::"plan");
DROP TYPE "plan_old";

-- The order that granted Plus, so a refund takes back only that purchase (RF-56),
-- and the purchase date (RDI-14).
ALTER TABLE "entitlement" ADD COLUMN "lemon_squeezy_order_id" TEXT;
ALTER TABLE "entitlement" ADD COLUMN "purchased_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "entitlement_lemon_squeezy_order_id_key" ON "entitlement"("lemon_squeezy_order_id");
