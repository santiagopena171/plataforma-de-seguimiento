-- Add sync configuration columns to pencas table
ALTER TABLE pencas ADD COLUMN IF NOT EXISTS sync_interval_minutes integer DEFAULT 0;
ALTER TABLE pencas ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;
