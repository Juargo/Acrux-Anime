-- Plus-only avatar presets (RF-55, epic #50): three new values of avatar_preset. Adding enum
-- values touches no existing row. The API refuses them without Plus and reads them as null
-- while the owner is not Plus, so a refund hides them and a later purchase brings them back.
ALTER TYPE "avatar_preset" ADD VALUE IF NOT EXISTS 'sakura';
ALTER TYPE "avatar_preset" ADD VALUE IF NOT EXISTS 'aurora';
ALTER TYPE "avatar_preset" ADD VALUE IF NOT EXISTS 'eclipse';
