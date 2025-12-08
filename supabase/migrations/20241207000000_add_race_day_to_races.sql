-- Add race_day column to races table
-- This allows grouping races by different days within a penca
-- NULL values indicate races created before this feature (backwards compatible)

ALTER TABLE races 
ADD COLUMN race_day INTEGER;

-- Add index for efficient querying by day
CREATE INDEX idx_races_race_day ON races(penca_id, race_day) WHERE race_day IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN races.race_day IS 'Optional day number to group races (e.g., 1 for Day 1, 2 for Day 2). NULL for races created before this feature or single-day pencas.';
