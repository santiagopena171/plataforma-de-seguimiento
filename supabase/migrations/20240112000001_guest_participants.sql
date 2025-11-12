-- Migration: Allow participants without authentication
-- Participants can be added by admin with just a name, no user account needed

-- 1. Make user_id nullable in memberships (for guest participants)
ALTER TABLE memberships 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add display_name directly to memberships for guest participants
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- 3. Add constraint: either user_id OR guest_name must be present
ALTER TABLE memberships
  ADD CONSTRAINT memberships_user_or_guest_check 
  CHECK (
    (user_id IS NOT NULL AND guest_name IS NULL) OR 
    (user_id IS NULL AND guest_name IS NOT NULL)
  );

-- 4. Make user_id nullable in predictions (predictions can be for guest participants)
ALTER TABLE predictions
  ALTER COLUMN user_id DROP NOT NULL;

-- 5. Add guest_participant_id to link predictions to memberships
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE;

-- 6. Add constraint: predictions must have either user_id or membership_id
ALTER TABLE predictions
  ADD CONSTRAINT predictions_user_or_membership_check
  CHECK (
    (user_id IS NOT NULL AND membership_id IS NULL) OR
    (user_id IS NULL AND membership_id IS NOT NULL)
  );

-- 7. Update scores table to work with memberships instead of just user_id
ALTER TABLE scores
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE;

ALTER TABLE scores
  ADD CONSTRAINT scores_user_or_membership_check
  CHECK (
    (user_id IS NOT NULL AND membership_id IS NULL) OR
    (user_id IS NULL AND membership_id IS NOT NULL)
  );

-- 8. Create index for guest participants
CREATE INDEX IF NOT EXISTS idx_memberships_guest_name ON memberships(guest_name) WHERE guest_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_membership_id ON predictions(membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scores_membership_id ON scores(membership_id) WHERE membership_id IS NOT NULL;

-- 9. Update RLS policies to allow public read access to pencas (by slug)
DROP POLICY IF EXISTS "Public can view open pencas" ON pencas;

CREATE POLICY "Public can view pencas by slug"
ON pencas FOR SELECT
USING (true); -- Everyone can read pencas (they need slug to access)

-- 10. Allow public to view race results and scores
DROP POLICY IF EXISTS "Public can view race results" ON race_results;

CREATE POLICY "Public can view race results"
ON race_results FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can view scores" ON scores;

CREATE POLICY "Public can view scores"
ON scores FOR SELECT
USING (true);

-- 11. Allow public to view predictions after race is published
DROP POLICY IF EXISTS "Public can view predictions after publication" ON predictions;

CREATE POLICY "Public can view predictions after publication"
ON predictions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM races r
    WHERE r.id = predictions.race_id
    AND r.status = 'result_published'
  )
);

-- 12. Allow admins to create memberships for guest participants
DROP POLICY IF EXISTS "Admins can add guest participants" ON memberships;

CREATE POLICY "Admins can add guest participants"
ON memberships FOR INSERT
WITH CHECK (
  -- User joins themselves OR admin adds a guest
  user_id = auth.uid() 
  OR (
    guest_name IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- 13. Update memberships SELECT policy to allow public viewing
DROP POLICY IF EXISTS "Public can view penca memberships" ON memberships;

CREATE POLICY "Public can view penca memberships"
ON memberships FOR SELECT
USING (true);

-- Comments for documentation
COMMENT ON COLUMN memberships.guest_name IS 'Display name for participants without user accounts (guest participants)';
COMMENT ON COLUMN predictions.membership_id IS 'Link to membership for guest participants (mutually exclusive with user_id)';
COMMENT ON COLUMN scores.membership_id IS 'Link to membership for guest participants (mutually exclusive with user_id)';
