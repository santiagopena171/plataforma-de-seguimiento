-- Add external_results_url column to pencas table
ALTER TABLE pencas ADD COLUMN IF NOT EXISTS external_results_url text;
