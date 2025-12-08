-- Add RLS policies for race_days table

-- Enable RLS if not already enabled
ALTER TABLE race_days ENABLE ROW LEVEL SECURITY;

-- Members can view race days of their pencas
CREATE POLICY "Members can view race days"
    ON race_days FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.penca_id = race_days.penca_id
            AND memberships.user_id = auth.uid()
        )
    );

-- Penca admins can insert race days
CREATE POLICY "Admins can insert race days"
    ON race_days FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.penca_id = race_days.penca_id
            AND memberships.user_id = auth.uid()
            AND memberships.role = 'admin'
        )
    );

-- Penca admins can update race days
CREATE POLICY "Admins can update race days"
    ON race_days FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.penca_id = race_days.penca_id
            AND memberships.user_id = auth.uid()
            AND memberships.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.penca_id = race_days.penca_id
            AND memberships.user_id = auth.uid()
            AND memberships.role = 'admin'
        )
    );

-- Penca admins can delete race days
CREATE POLICY "Admins can delete race days"
    ON race_days FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.penca_id = race_days.penca_id
            AND memberships.user_id = auth.uid()
            AND memberships.role = 'admin'
        )
    );

-- Allow service role to bypass RLS (this is implicit, but documenting here)
-- Service role automatically bypasses RLS policies
