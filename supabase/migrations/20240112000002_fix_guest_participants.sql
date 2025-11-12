-- Migration: Fix guest participants - handle primary key constraint
-- This migration properly handles the case where user_id is part of a primary key

-- Step 1: Drop foreign key constraints that depend on memberships primary key
DO $$ 
BEGIN
  -- Drop predictions foreign keys that reference memberships
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'predictions_membership_id_fkey'
  ) THEN
    ALTER TABLE predictions DROP CONSTRAINT predictions_membership_id_fkey;
  END IF;
  
  -- Drop scores foreign keys that reference memberships
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scores_membership_id_fkey'
  ) THEN
    ALTER TABLE scores DROP CONSTRAINT scores_membership_id_fkey;
  END IF;
END $$;

-- Step 2: Add id column BEFORE dropping primary key
ALTER TABLE memberships 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Step 3: Now drop the existing primary key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'memberships_pkey' 
    AND conrelid = 'memberships'::regclass
  ) THEN
    ALTER TABLE memberships DROP CONSTRAINT memberships_pkey;
  END IF;
END $$;

-- Step 4: Make id column the new primary key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'memberships_pkey' 
    AND conrelid = 'memberships'::regclass
  ) THEN
    ALTER TABLE memberships ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Step 5: Now we can make user_id nullable
ALTER TABLE memberships 
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 6: Add guest_name column if not exists
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Step 7: Add unique constraint for (penca_id, user_id) where user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS memberships_penca_user_unique 
ON memberships(penca_id, user_id) 
WHERE user_id IS NOT NULL;

-- Step 8: Add constraint: either user_id OR guest_name must be present (but not both)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'memberships_user_or_guest_check'
  ) THEN
    ALTER TABLE memberships
      ADD CONSTRAINT memberships_user_or_guest_check 
      CHECK (
        (user_id IS NOT NULL AND guest_name IS NULL) OR 
        (user_id IS NULL AND guest_name IS NOT NULL)
      );
  END IF;
END $$;

-- Step 9: Handle predictions table
ALTER TABLE predictions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS membership_id UUID;

-- Re-add foreign key constraint for predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'predictions_membership_id_fkey'
  ) THEN
    ALTER TABLE predictions
      ADD CONSTRAINT predictions_membership_id_fkey 
      FOREIGN KEY (membership_id) 
      REFERENCES memberships(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'predictions_user_or_membership_check'
  ) THEN
    ALTER TABLE predictions DROP CONSTRAINT predictions_user_or_membership_check;
  END IF;
END $$;

-- Add constraint: predictions must have either user_id or membership_id
ALTER TABLE predictions
  ADD CONSTRAINT predictions_user_or_membership_check
  CHECK (
    (user_id IS NOT NULL AND membership_id IS NULL) OR
    (user_id IS NULL AND membership_id IS NOT NULL)
  );

-- Step 10: Handle scores table
ALTER TABLE scores
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS membership_id UUID;

-- Re-add foreign key constraint for scores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scores_membership_id_fkey'
  ) THEN
    ALTER TABLE scores
      ADD CONSTRAINT scores_membership_id_fkey 
      FOREIGN KEY (membership_id) 
      REFERENCES memberships(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'scores_user_or_membership_check'
  ) THEN
    ALTER TABLE scores DROP CONSTRAINT scores_user_or_membership_check;
  END IF;
END $$;

-- Add constraint: scores must have either user_id or membership_id
ALTER TABLE scores
  ADD CONSTRAINT scores_user_or_membership_check
  CHECK (
    (user_id IS NOT NULL AND membership_id IS NULL) OR
    (user_id IS NULL AND membership_id IS NOT NULL)
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_guest_name ON memberships(guest_name) WHERE guest_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_membership_id ON predictions(membership_id) WHERE membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scores_membership_id ON scores(membership_id) WHERE membership_id IS NOT NULL;

-- Update RLS policies
-- For pencas
DROP POLICY IF EXISTS "Public can view open pencas" ON pencas;
DROP POLICY IF EXISTS "Public can view pencas by slug" ON pencas;
CREATE POLICY "Public can view pencas by slug"
ON pencas FOR SELECT
USING (true);

-- For race_results
DROP POLICY IF EXISTS "Public can view race results" ON race_results;
CREATE POLICY "Public can view race results"
ON race_results FOR SELECT
USING (true);

-- For scores
DROP POLICY IF EXISTS "Public can view scores" ON scores;
CREATE POLICY "Public can view scores"
ON scores FOR SELECT
USING (true);

-- For predictions
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

-- For memberships
DROP POLICY IF EXISTS "Admins can add guest participants" ON memberships;
CREATE POLICY "Admins can add guest participants"
ON memberships FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR (
    guest_name IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "Public can view penca memberships" ON memberships;
CREATE POLICY "Public can view penca memberships"
ON memberships FOR SELECT
USING (true);

-- Comments
COMMENT ON COLUMN memberships.guest_name IS 'Display name for participants without user accounts (guest participants)';
COMMENT ON COLUMN predictions.membership_id IS 'Link to membership for guest participants (mutually exclusive with user_id)';
COMMENT ON COLUMN scores.membership_id IS 'Link to membership for guest participants (mutually exclusive with user_id)';
