-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE penca_status AS ENUM ('draft', 'open', 'in_progress', 'closed');
CREATE TYPE race_status AS ENUM ('scheduled', 'closed', 'result_published');
CREATE TYPE membership_role AS ENUM ('player');

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- PROFILES TABLE
-- ========================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profile indexes
CREATE INDEX idx_profiles_role ON profiles(role);

-- ========================================
-- PENCAS TABLE
-- ========================================
CREATE TABLE pencas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status penca_status NOT NULL DEFAULT 'draft',
    rules_version_active INTEGER,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pencas indexes
CREATE INDEX idx_pencas_slug ON pencas(slug);
CREATE INDEX idx_pencas_status ON pencas(status);
CREATE INDEX idx_pencas_created_by ON pencas(created_by);

-- ========================================
-- PENCA_ADMINS TABLE
-- ========================================
CREATE TABLE penca_admins (
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (penca_id, user_id)
);

-- Penca_admins indexes
CREATE INDEX idx_penca_admins_user_id ON penca_admins(user_id);

-- ========================================
-- RULESETS TABLE
-- ========================================
CREATE TABLE rulesets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    points_top3 JSONB NOT NULL DEFAULT '{"first": 5, "second": 3, "third": 1}',
    modalities_enabled JSONB NOT NULL DEFAULT '["winner"]',
    tiebreakers_order JSONB NOT NULL DEFAULT '[]',
    lock_minutes_before_start INTEGER NOT NULL DEFAULT 15,
    sealed_predictions_until_close BOOLEAN NOT NULL DEFAULT true,
    effective_from_race_seq INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (penca_id, version)
);

-- Rulesets indexes
CREATE INDEX idx_rulesets_penca_id ON rulesets(penca_id);
CREATE INDEX idx_rulesets_active ON rulesets(penca_id, is_active) WHERE is_active = true;

-- ========================================
-- RACES TABLE
-- ========================================
CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    venue TEXT NOT NULL,
    distance_m INTEGER NOT NULL,
    track_condition TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    status race_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (penca_id, seq),
    CONSTRAINT start_at_not_past CHECK (start_at > created_at)
);

-- Races indexes
CREATE INDEX idx_races_penca_id ON races(penca_id);
CREATE INDEX idx_races_status ON races(status);
CREATE INDEX idx_races_start_at ON races(start_at);
CREATE INDEX idx_races_penca_seq ON races(penca_id, seq);

-- ========================================
-- RACE_ENTRIES TABLE
-- ========================================
CREATE TABLE race_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    program_number INTEGER NOT NULL,
    horse_name TEXT NOT NULL,
    jockey TEXT,
    trainer TEXT,
    stud TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, program_number)
);

-- Race_entries indexes
CREATE INDEX idx_race_entries_race_id ON race_entries(race_id);

-- ========================================
-- MEMBERSHIPS TABLE
-- ========================================
CREATE TABLE memberships (
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'player',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (penca_id, user_id)
);

-- Memberships indexes
CREATE INDEX idx_memberships_user_id ON memberships(user_id);

-- ========================================
-- INVITES TABLE
-- ========================================
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invites indexes
CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_penca_id ON invites(penca_id);

-- ========================================
-- PREDICTIONS TABLE
-- ========================================
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    winner_pick UUID REFERENCES race_entries(id) ON DELETE SET NULL,
    exacta_pick JSONB, -- [entry_id_1, entry_id_2]
    trifecta_pick JSONB, -- [entry_id_1, entry_id_2, entry_id_3]
    tiebreaker_value TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, user_id)
);

-- Predictions indexes
CREATE INDEX idx_predictions_race_id ON predictions(race_id);
CREATE INDEX idx_predictions_user_id ON predictions(user_id);

-- ========================================
-- RACE_RESULTS TABLE
-- ========================================
CREATE TABLE race_results (
    race_id UUID PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
    official_order JSONB NOT NULL, -- [entry_id_1, entry_id_2, entry_id_3]
    notes TEXT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- SCORES TABLE
-- ========================================
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points_total INTEGER NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}', -- {"winner": 5, "exacta": 0, "trifecta": 0, "top3": [5,3,0]}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, user_id)
);

-- Scores indexes
CREATE INDEX idx_scores_penca_id ON scores(penca_id);
CREATE INDEX idx_scores_race_id ON scores(race_id);
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_penca_user ON scores(penca_id, user_id);

-- ========================================
-- AUDIT_LOG TABLE
-- ========================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    diff JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit_log indexes
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ========================================
-- TRIGGERS FOR updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pencas_updated_at BEFORE UPDATE ON pencas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rulesets_updated_at BEFORE UPDATE ON rulesets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_races_updated_at BEFORE UPDATE ON races
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_race_entries_updated_at BEFORE UPDATE ON race_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_race_results_updated_at BEFORE UPDATE ON race_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FUNCTION: Auto-create profile on signup
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new auth user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- FUNCTION: Check if user is admin of penca
-- ========================================
CREATE OR REPLACE FUNCTION is_penca_admin(penca_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM penca_admins
        WHERE penca_id = penca_id_param AND user_id = user_id_param
    ) OR EXISTS (
        SELECT 1 FROM pencas
        WHERE id = penca_id_param AND created_by = user_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTION: Check if user is member of penca
-- ========================================
CREATE OR REPLACE FUNCTION is_penca_member(penca_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM memberships
        WHERE penca_id = penca_id_param AND user_id = user_id_param
    ) OR is_penca_admin(penca_id_param, user_id_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTION: Check if prediction is locked
-- ========================================
CREATE OR REPLACE FUNCTION is_prediction_locked(race_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    race_start TIMESTAMPTZ;
    lock_minutes INTEGER;
BEGIN
    SELECT r.start_at, rs.lock_minutes_before_start
    INTO race_start, lock_minutes
    FROM races r
    JOIN rulesets rs ON rs.penca_id = r.penca_id AND rs.is_active = true
    WHERE r.id = race_id_param;
    
    RETURN NOW() >= (race_start - (lock_minutes || ' minutes')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- VIEWS
-- ========================================

-- View: Leaderboard por penca
CREATE OR REPLACE VIEW penca_leaderboard AS
SELECT
    s.penca_id,
    s.user_id,
    p.display_name,
    p.avatar_url,
    SUM(s.points_total) as total_points,
    COUNT(DISTINCT s.race_id) as races_participated,
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'race_id', s.race_id,
            'points', s.points_total,
            'breakdown', s.breakdown
        ) ORDER BY r.seq
    ) as race_details
FROM scores s
JOIN profiles p ON p.id = s.user_id
JOIN races r ON r.id = s.race_id
GROUP BY s.penca_id, s.user_id, p.display_name, p.avatar_url
ORDER BY total_points DESC;

-- View: Próximas carreras
CREATE OR REPLACE VIEW upcoming_races AS
SELECT
    r.id,
    r.penca_id,
    p.name as penca_name,
    r.seq,
    r.venue,
    r.distance_m,
    r.track_condition,
    r.start_at,
    r.status,
    rs.lock_minutes_before_start,
    (r.start_at - (rs.lock_minutes_before_start || ' minutes')::INTERVAL) as lock_at,
    COUNT(DISTINCT re.id) as entries_count,
    COUNT(DISTINCT pr.id) as predictions_count
FROM races r
JOIN pencas p ON p.id = r.penca_id
JOIN rulesets rs ON rs.penca_id = r.penca_id AND rs.is_active = true
LEFT JOIN race_entries re ON re.race_id = r.id
LEFT JOIN predictions pr ON pr.race_id = r.id
WHERE r.status = 'scheduled' AND r.start_at > NOW()
GROUP BY r.id, p.name, rs.lock_minutes_before_start
ORDER BY r.start_at ASC;

-- Comment on tables
COMMENT ON TABLE profiles IS 'User profiles with roles (admin/user)';
COMMENT ON TABLE pencas IS 'Pencas (competitions) created by admins';
COMMENT ON TABLE penca_admins IS 'Co-administrators for each penca';
COMMENT ON TABLE rulesets IS 'Versioned rules for each penca';
COMMENT ON TABLE races IS 'Individual horse races within a penca';
COMMENT ON TABLE race_entries IS 'Horses/entries participating in each race';
COMMENT ON TABLE memberships IS 'Players who have joined a penca';
COMMENT ON TABLE invites IS 'Invitation codes to join pencas';
COMMENT ON TABLE predictions IS 'User predictions for races';
COMMENT ON TABLE race_results IS 'Official results (top 3) for each race';
COMMENT ON TABLE scores IS 'Calculated points for each user per race';
COMMENT ON TABLE audit_log IS 'Audit trail of admin actions';
