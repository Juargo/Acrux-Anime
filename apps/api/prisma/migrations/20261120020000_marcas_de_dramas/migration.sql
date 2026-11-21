-- The dramas a user marked (#154): one mark for the whole show, with the same two states as
-- an anime mark. A new table: "mark" and its rows are not touched, so every anime mark stays
-- as it is. It goes away with the profile, like every other row about a user.
CREATE TABLE "drama_mark" (
    "user_id" UUID NOT NULL,
    "drama_id" INTEGER NOT NULL,
    "status" "mark_status" NOT NULL,
    "marked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drama_mark_pkey" PRIMARY KEY ("user_id","drama_id")
);

ALTER TABLE "drama_mark" ADD CONSTRAINT "drama_mark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only a drama of the table can be marked. The load job never deletes one (ADR-0046).
ALTER TABLE "drama_mark" ADD CONSTRAINT "drama_mark_drama_id_fkey" FOREIGN KEY ("drama_id") REFERENCES "drama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS like every table of public: only acrux_api has grants and a policy (ADR-0028). The
-- load job of the dramas (acrux_dramas) reaches "drama" alone, never what a user marked.
ALTER TABLE "drama_mark" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON "drama_mark" TO acrux_api;
CREATE POLICY "acrux_api_all" ON "drama_mark" TO acrux_api USING (true) WITH CHECK (true);
