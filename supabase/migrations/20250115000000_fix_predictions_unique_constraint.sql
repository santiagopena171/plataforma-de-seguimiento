-- Fix predictions unique constraint to work with both user_id and membership_id

-- Drop old unique constraint on (race_id, user_id)
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_race_id_user_id_key;

-- Add unique constraint for race_id + user_id when user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS predictions_race_user_unique
ON predictions(race_id, user_id)
WHERE user_id IS NOT NULL;

-- Add unique constraint for race_id + membership_id when membership_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS predictions_race_membership_unique
ON predictions(race_id, membership_id)
WHERE membership_id IS NOT NULL;
