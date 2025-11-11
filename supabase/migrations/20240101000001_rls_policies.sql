-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE penca_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES POLICIES
-- ========================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Public can view basic profile info of members in their pencas
CREATE POLICY "Users can view profiles of penca members"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM memberships m1
            JOIN memberships m2 ON m1.penca_id = m2.penca_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
        )
    );

-- ========================================
-- PENCAS POLICIES
-- ========================================

-- Only admins can create pencas
CREATE POLICY "Only admins can create pencas"
    ON pencas FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Members can view pencas they belong to
CREATE POLICY "Members can view their pencas"
    ON pencas FOR SELECT
    USING (
        is_penca_member(id, auth.uid())
    );

-- Penca admins can update their pencas
CREATE POLICY "Admins can update their pencas"
    ON pencas FOR UPDATE
    USING (is_penca_admin(id, auth.uid()))
    WITH CHECK (is_penca_admin(id, auth.uid()));

-- Penca admins can delete their pencas
CREATE POLICY "Admins can delete their pencas"
    ON pencas FOR DELETE
    USING (is_penca_admin(id, auth.uid()));

-- ========================================
-- PENCA_ADMINS POLICIES
-- ========================================

-- Members can view admins of their pencas
CREATE POLICY "Members can view penca admins"
    ON penca_admins FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Only penca admins can add co-admins
CREATE POLICY "Admins can add co-admins"
    ON penca_admins FOR INSERT
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- Only penca admins can remove co-admins
CREATE POLICY "Admins can remove co-admins"
    ON penca_admins FOR DELETE
    USING (is_penca_admin(penca_id, auth.uid()));

-- ========================================
-- RULESETS POLICIES
-- ========================================

-- Members can view rulesets of their pencas
CREATE POLICY "Members can view rulesets"
    ON rulesets FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Only admins can create rulesets
CREATE POLICY "Admins can create rulesets"
    ON rulesets FOR INSERT
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- Only admins can update rulesets (if no races affected yet)
CREATE POLICY "Admins can update rulesets"
    ON rulesets FOR UPDATE
    USING (
        is_penca_admin(penca_id, auth.uid())
        AND NOT EXISTS (
            SELECT 1 FROM races
            WHERE penca_id = rulesets.penca_id
            AND seq >= rulesets.effective_from_race_seq
            AND status != 'scheduled'
        )
    )
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- ========================================
-- RACES POLICIES
-- ========================================

-- Members can view races of their pencas
CREATE POLICY "Members can view races"
    ON races FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Only admins can create races
CREATE POLICY "Admins can create races"
    ON races FOR INSERT
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- Only admins can update races
CREATE POLICY "Admins can update races"
    ON races FOR UPDATE
    USING (is_penca_admin(penca_id, auth.uid()))
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- Only admins can delete races (if not closed)
CREATE POLICY "Admins can delete races"
    ON races FOR DELETE
    USING (
        is_penca_admin(penca_id, auth.uid())
        AND status = 'scheduled'
    );

-- ========================================
-- RACE_ENTRIES POLICIES
-- ========================================

-- Members can view entries of races in their pencas
CREATE POLICY "Members can view race entries"
    ON race_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_entries.race_id
            AND is_penca_member(penca_id, auth.uid())
        )
    );

-- Only admins can manage race entries
CREATE POLICY "Admins can insert race entries"
    ON race_entries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_entries.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    );

CREATE POLICY "Admins can update race entries"
    ON race_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_entries.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_entries.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    );

CREATE POLICY "Admins can delete race entries"
    ON race_entries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_entries.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    );

-- ========================================
-- MEMBERSHIPS POLICIES
-- ========================================

-- Users can view memberships of pencas they belong to
CREATE POLICY "Members can view penca memberships"
    ON memberships FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Users can join with valid invite code (handled by edge function)
CREATE POLICY "Users can join with invite"
    ON memberships FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can remove members
CREATE POLICY "Admins can remove members"
    ON memberships FOR DELETE
    USING (is_penca_admin(penca_id, auth.uid()));

-- ========================================
-- INVITES POLICIES
-- ========================================

-- Members can view invites of their pencas
CREATE POLICY "Members can view invites"
    ON invites FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Admins can create invites
CREATE POLICY "Admins can create invites"
    ON invites FOR INSERT
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

-- Admins can update/delete invites
CREATE POLICY "Admins can update invites"
    ON invites FOR UPDATE
    USING (is_penca_admin(penca_id, auth.uid()))
    WITH CHECK (is_penca_admin(penca_id, auth.uid()));

CREATE POLICY "Admins can delete invites"
    ON invites FOR DELETE
    USING (is_penca_admin(penca_id, auth.uid()));

-- ========================================
-- PREDICTIONS POLICIES
-- ========================================

-- Users can create their own predictions (before lock)
CREATE POLICY "Users can create predictions"
    ON predictions FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM races r
            JOIN rulesets rs ON rs.penca_id = r.penca_id AND rs.is_active = true
            WHERE r.id = race_id
            AND is_penca_member(r.penca_id, auth.uid())
            AND NOT is_prediction_locked(r.id)
            AND r.status = 'scheduled'
        )
    );

-- Users can update their own predictions (before lock)
CREATE POLICY "Users can update predictions"
    ON predictions FOR UPDATE
    USING (
        user_id = auth.uid()
        AND NOT is_locked
        AND EXISTS (
            SELECT 1 FROM races r
            WHERE r.id = race_id
            AND NOT is_prediction_locked(r.id)
            AND r.status = 'scheduled'
        )
    )
    WITH CHECK (user_id = auth.uid());

-- Sealed predictions: users see only their own before close
CREATE POLICY "Users see own predictions before close (sealed)"
    ON predictions FOR SELECT
    USING (
        user_id = auth.uid()
        OR (
            EXISTS (
                SELECT 1 FROM races r
                JOIN rulesets rs ON rs.penca_id = r.penca_id AND rs.is_active = true
                WHERE r.id = predictions.race_id
                AND is_penca_member(r.penca_id, auth.uid())
                AND (
                    -- After race is closed, everyone can see
                    r.status IN ('closed', 'result_published')
                    -- Or if not sealed, members can always see
                    OR rs.sealed_predictions_until_close = false
                )
            )
        )
    );

-- ========================================
-- RACE_RESULTS POLICIES
-- ========================================

-- Members can view results of their pencas
CREATE POLICY "Members can view race results"
    ON race_results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_results.race_id
            AND is_penca_member(penca_id, auth.uid())
        )
    );

-- Only admins can publish/update results
CREATE POLICY "Admins can insert race results"
    ON race_results FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_results.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    );

CREATE POLICY "Admins can update race results"
    ON race_results FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_results.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE id = race_results.race_id
            AND is_penca_admin(penca_id, auth.uid())
        )
    );

-- ========================================
-- SCORES POLICIES
-- ========================================

-- Members can view scores of their pencas
CREATE POLICY "Members can view scores"
    ON scores FOR SELECT
    USING (is_penca_member(penca_id, auth.uid()));

-- Only service_role (edge functions) can insert/update scores
-- No user policies for INSERT/UPDATE (handled by edge functions with service_role)

-- ========================================
-- AUDIT_LOG POLICIES
-- ========================================

-- Admins can view audit logs of their pencas
CREATE POLICY "Admins can view audit logs"
    ON audit_log FOR SELECT
    USING (
        -- If target is a penca-related action, check admin status
        CASE
            WHEN target_table = 'pencas' THEN
                is_penca_admin(target_id, auth.uid())
            WHEN target_table IN ('races', 'race_entries', 'race_results', 'rulesets') THEN
                EXISTS (
                    SELECT 1 FROM races r
                    WHERE (
                        (target_table = 'races' AND r.id = target_id)
                        OR (target_table = 'race_entries' AND EXISTS (
                            SELECT 1 FROM race_entries WHERE id = target_id AND race_id = r.id
                        ))
                        OR (target_table = 'race_results' AND r.id = target_id)
                        OR (target_table = 'rulesets' AND EXISTS (
                            SELECT 1 FROM rulesets WHERE id = target_id AND penca_id = r.penca_id
                        ))
                    )
                    AND is_penca_admin(r.penca_id, auth.uid())
                )
            ELSE
                actor_id = auth.uid()
        END
    );

-- Anyone can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (true);

-- ========================================
-- GRANT ACCESS TO VIEWS
-- ========================================

GRANT SELECT ON penca_leaderboard TO authenticated;
GRANT SELECT ON upcoming_races TO authenticated;
