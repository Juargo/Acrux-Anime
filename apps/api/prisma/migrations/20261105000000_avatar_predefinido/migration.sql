-- Edit the display name and avatar (#39): a preset Acrux avatar instead of Google's.
-- Nullable, so existing profiles keep showing their Google avatar. The name rules live in
-- the API: names that come from Google may be longer than what users can type (30).
CREATE TYPE "avatar_preset" AS ENUM ('violeta', 'verde', 'amarillo', 'coral', 'noche', 'lavanda');

ALTER TABLE "profile" ADD COLUMN "avatar_preset" "avatar_preset";
