-- Fix: Allow users to read their own 'role' field in profiles table
-- This is needed for admin authentication to work properly

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create a new policy that allows users to read their own profile completely
-- This includes the 'role' field which is critical for admin access
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname = 'Users can view own profile';

-- Test query: Check if you can read your own role
-- Run this to verify it works
SELECT id, display_name, role, created_at
FROM profiles
WHERE id = auth.uid();
