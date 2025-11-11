-- ============================================================================
-- PENCAS HÍPICAS - SCRIPT COMPLETO DE SETUP
-- ============================================================================
-- Ejecuta este script completo en Supabase SQL Editor
-- Este archivo combina todas las migraciones + seed data
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE penca_status AS ENUM ('draft', 'open', 'in_progress', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE race_status AS ENUM ('scheduled', 'closed', 'result_published');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE membership_role AS ENUM ('player');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PARTE 1: CREAR TABLAS
-- ============================================================================

-- Drop tables if exist (para re-ejecutar el script)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS race_results CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS race_entries CASCADE;
DROP TABLE IF EXISTS races CASCADE;
DROP TABLE IF EXISTS invites CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS rulesets CASCADE;
DROP TABLE IF EXISTS penca_admins CASCADE;
DROP TABLE IF EXISTS pencas CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Pencas
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

CREATE INDEX idx_pencas_slug ON pencas(slug);
CREATE INDEX idx_pencas_status ON pencas(status);
CREATE INDEX idx_pencas_created_by ON pencas(created_by);

-- Penca Admins
CREATE TABLE penca_admins (
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (penca_id, user_id)
);

CREATE INDEX idx_penca_admins_user_id ON penca_admins(user_id);

-- Rulesets
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

CREATE INDEX idx_rulesets_penca_id ON rulesets(penca_id);
CREATE INDEX idx_rulesets_active ON rulesets(penca_id, is_active) WHERE is_active = true;

-- Races
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
    UNIQUE (penca_id, seq)
);

CREATE INDEX idx_races_penca_id ON races(penca_id);
CREATE INDEX idx_races_status ON races(status);
CREATE INDEX idx_races_start_at ON races(start_at);
CREATE INDEX idx_races_penca_seq ON races(penca_id, seq);

-- Race Entries
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

CREATE INDEX idx_race_entries_race_id ON race_entries(race_id);

-- Memberships
CREATE TABLE memberships (
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'player',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (penca_id, user_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);

-- Invites
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

CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_penca_id ON invites(penca_id);

-- Predictions
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    winner_pick UUID REFERENCES race_entries(id) ON DELETE SET NULL,
    exacta_pick JSONB,
    trifecta_pick JSONB,
    tiebreaker_value TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, user_id)
);

CREATE INDEX idx_predictions_race_id ON predictions(race_id);
CREATE INDEX idx_predictions_user_id ON predictions(user_id);

-- Race Results
CREATE TABLE race_results (
    race_id UUID PRIMARY KEY REFERENCES races(id) ON DELETE CASCADE,
    official_order JSONB NOT NULL,
    notes TEXT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scores
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penca_id UUID NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
    race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points_total INTEGER NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, user_id)
);

CREATE INDEX idx_scores_penca_id ON scores(penca_id);
CREATE INDEX idx_scores_race_id ON scores(race_id);
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_penca_user ON scores(penca_id, user_id);

-- Audit Log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    diff JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- PARTE 2: TRIGGERS Y FUNCIONES
-- ============================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
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

-- Auto-create profile on signup
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper functions
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

CREATE OR REPLACE FUNCTION is_penca_member(penca_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM memberships
        WHERE penca_id = penca_id_param AND user_id = user_id_param
    ) OR is_penca_admin(penca_id_param, user_id_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================================================
-- PARTE 3: VISTAS
-- ============================================================================

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
GROUP BY s.penca_id, s.user_id, p.display_name, p.avatar_url;

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

-- ============================================================================
-- PARTE 4: RLS POLICIES (CONTINÚA EN SIGUIENTE COMENTARIO)
-- ============================================================================
-- NOTA: Ejecuta este script primero, luego ejecuta el script de RLS por separado
