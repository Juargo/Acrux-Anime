-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "list_visibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "counter_mode" AS ENUM ('franchise', 'entry');

-- CreateEnum
CREATE TYPE "mark_status" AS ENUM ('seen', 'watching');

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('plus_annual', 'plus_lifetime');

-- CreateEnum
CREATE TYPE "franchise_role" AS ENUM ('core', 'extra', 'separate');

-- CreateTable
CREATE TABLE "profile" (
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "list_visibility" "list_visibility" NOT NULL DEFAULT 'private',
    "counter_mode" "counter_mode" NOT NULL DEFAULT 'franchise',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "mark" (
    "user_id" UUID NOT NULL,
    "anilist_id" INTEGER NOT NULL,
    "mal_id" INTEGER,
    "status" "mark_status" NOT NULL,
    "marked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_pkey" PRIMARY KEY ("user_id","anilist_id")
);

-- CreateTable
CREATE TABLE "anilist_link" (
    "user_id" UUID NOT NULL,
    "anilist_user_id" INTEGER NOT NULL,
    "access_token_encrypted" BYTEA NOT NULL,
    "token_expires_at" TIMESTAMPTZ(6),
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anilist_link_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "user_id" UUID NOT NULL,
    "plan" "plan" NOT NULL,
    "valid_until" TIMESTAMPTZ(6),
    "lemon_squeezy_customer_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "billing_event" (
    "event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "franchise_override" (
    "anilist_id" INTEGER NOT NULL,
    "franchise_root_id" INTEGER NOT NULL,
    "role" "franchise_role" NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "franchise_override_pkey" PRIMARY KEY ("anilist_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anilist_link_anilist_user_id_key" ON "anilist_link"("anilist_user_id");

-- AddForeignKey
ALTER TABLE "mark" ADD CONSTRAINT "mark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anilist_link" ADD CONSTRAINT "anilist_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Runtime role of the API (ADR-0022, ADR-0028). Created in SQL, not with the Neon API,
-- so it does not join neon_superuser. It starts without login: each Neon branch gives it
-- a login and a secret password outside the repository.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'acrux_api') THEN
    CREATE ROLE acrux_api NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO acrux_api;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "profile", "mark", "anilist_link", "entitlement", "billing_event", "franchise_override"
  TO acrux_api;

-- RLS on every table of public. Only acrux_api has a policy; any other non-owner role
-- (such as the Neon Data API roles, which stay off) has no grants and no policy.
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anilist_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "franchise_override" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acrux_api_all" ON "profile" TO acrux_api USING (true) WITH CHECK (true);
CREATE POLICY "acrux_api_all" ON "mark" TO acrux_api USING (true) WITH CHECK (true);
CREATE POLICY "acrux_api_all" ON "anilist_link" TO acrux_api USING (true) WITH CHECK (true);
CREATE POLICY "acrux_api_all" ON "entitlement" TO acrux_api USING (true) WITH CHECK (true);
CREATE POLICY "acrux_api_all" ON "billing_event" TO acrux_api USING (true) WITH CHECK (true);
CREATE POLICY "acrux_api_all" ON "franchise_override" TO acrux_api USING (true) WITH CHECK (true);
