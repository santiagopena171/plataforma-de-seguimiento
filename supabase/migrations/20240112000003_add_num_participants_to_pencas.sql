-- Add num_participants to pencas table
-- This defines how many members/players can join the penca

ALTER TABLE pencas
  ADD COLUMN IF NOT EXISTS num_participants INTEGER NOT NULL DEFAULT 8
  CHECK (num_participants >= 3);

COMMENT ON COLUMN pencas.num_participants IS 'Maximum number of members/players that can join this penca (default 8, minimum 3)';
