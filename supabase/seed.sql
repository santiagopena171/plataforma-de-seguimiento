-- Seed data for testing
-- Run with: supabase db seed

-- Clean existing data (for re-seeding)
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE scores CASCADE;
TRUNCATE TABLE race_results CASCADE;
TRUNCATE TABLE predictions CASCADE;
TRUNCATE TABLE race_entries CASCADE;
TRUNCATE TABLE races CASCADE;
TRUNCATE TABLE invites CASCADE;
TRUNCATE TABLE memberships CASCADE;
TRUNCATE TABLE rulesets CASCADE;
TRUNCATE TABLE penca_admins CASCADE;
TRUNCATE TABLE pencas CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- Create test users (requires auth.users to exist)
-- Note: In production, users are created via Supabase Auth
-- For local testing, manually create auth users first via Supabase Dashboard

-- Insert profiles
-- Admin user
INSERT INTO profiles (id, display_name, role, avatar_url) VALUES
('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin', NULL);

-- Regular users
INSERT INTO profiles (id, display_name, role, avatar_url) VALUES
('00000000-0000-0000-0000-000000000002', 'Juan Pérez', 'user', NULL),
('00000000-0000-0000-0000-000000000003', 'María García', 'user', NULL),
('00000000-0000-0000-0000-000000000004', 'Carlos López', 'user', NULL),
('00000000-0000-0000-0000-000000000005', 'Ana Martínez', 'user', NULL),
('00000000-0000-0000-0000-000000000006', 'Pedro Rodríguez', 'user', NULL);

-- Create a test penca
INSERT INTO pencas (id, slug, name, description, status, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 'penca-prueba', 'Penca de Prueba', 'Penca de ejemplo para testing', 'open', '00000000-0000-0000-0000-000000000001');

-- Add admin to penca_admins
INSERT INTO penca_admins (penca_id, user_id) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001');

-- Create ruleset for the penca
INSERT INTO rulesets (id, penca_id, version, points_top3, modalities_enabled, tiebreakers_order, lock_minutes_before_start, sealed_predictions_until_close, effective_from_race_seq, exclusive_winner_points, is_active) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, 
'{"first": 5, "second": 3, "third": 1}'::jsonb, 
'["winner", "exacta"]'::jsonb, 
'[]'::jsonb, 
15, 
true, 
1,
25,
true);

-- Update penca with active ruleset
UPDATE pencas SET rules_version_active = 1 WHERE id = '11111111-1111-1111-1111-111111111111';

-- Create memberships (users join the penca)
INSERT INTO memberships (penca_id, user_id, role) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'player'),
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'player'),
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 'player'),
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'player'),
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 'player');

-- Create invite code
INSERT INTO invites (id, penca_id, code, expires_at, max_uses, uses, created_by) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'TESTCODE123', NOW() + INTERVAL '30 days', 10, 5, '00000000-0000-0000-0000-000000000001');

-- Create 3 races (1 hour apart)
INSERT INTO races (id, penca_id, seq, venue, distance_m, track_condition, start_at, status) VALUES
('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 1, 'Hipódromo de Palermo', 1200, 'Buena', NOW() + INTERVAL '2 hours', 'scheduled'),
('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', 2, 'Hipódromo de Palermo', 1400, 'Buena', NOW() + INTERVAL '3 hours', 'scheduled'),
('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', 3, 'Hipódromo de Palermo', 1600, 'Buena', NOW() + INTERVAL '4 hours', 'scheduled');

-- Add race entries for Race 1
INSERT INTO race_entries (id, race_id, program_number, horse_name, jockey, trainer, stud) VALUES
('55555555-5555-5555-5555-555555555511', '44444444-4444-4444-4444-444444444441', 1, 'Rayo de Luna', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
('55555555-5555-5555-5555-555555555512', '44444444-4444-4444-4444-444444444441', 2, 'Trueno Negro', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
('55555555-5555-5555-5555-555555555513', '44444444-4444-4444-4444-444444444441', 3, 'Viento del Sur', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
('55555555-5555-5555-5555-555555555514', '44444444-4444-4444-4444-444444444441', 4, 'Estrella Fugaz', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
('55555555-5555-5555-5555-555555555515', '44444444-4444-4444-4444-444444444441', 5, 'Relámpago Azul', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
('55555555-5555-5555-5555-555555555516', '44444444-4444-4444-4444-444444444441', 6, 'Sombra Veloz', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
('55555555-5555-5555-5555-555555555517', '44444444-4444-4444-4444-444444444441', 7, 'Fuego Salvaje', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
('55555555-5555-5555-5555-555555555518', '44444444-4444-4444-4444-444444444441', 8, 'Oro Negro', 'F. Cruz', 'L. Herrera', 'Haras La Pampa');

-- Add race entries for Race 2
INSERT INTO race_entries (id, race_id, program_number, horse_name, jockey, trainer, stud) VALUES
('55555555-5555-5555-5555-555555555521', '44444444-4444-4444-4444-444444444442', 1, 'Cometa Dorado', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
('55555555-5555-5555-5555-555555555522', '44444444-4444-4444-4444-444444444442', 2, 'Luna Plateada', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
('55555555-5555-5555-5555-555555555523', '44444444-4444-4444-4444-444444444442', 3, 'Rey del Viento', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
('55555555-5555-5555-5555-555555555524', '44444444-4444-4444-4444-444444444442', 4, 'Príncipe Negro', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
('55555555-5555-5555-5555-555555555525', '44444444-4444-4444-4444-444444444442', 5, 'Águila Real', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
('55555555-5555-5555-5555-555555555526', '44444444-4444-4444-4444-444444444442', 6, 'Diamante Azul', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
('55555555-5555-5555-5555-555555555527', '44444444-4444-4444-4444-444444444442', 7, 'Tornado Rojo', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
('55555555-5555-5555-5555-555555555528', '44444444-4444-4444-4444-444444444442', 8, 'Centella Blanca', 'F. Cruz', 'L. Herrera', 'Haras La Pampa'),
('55555555-5555-5555-5555-555555555529', '44444444-4444-4444-4444-444444444442', 9, 'Rayo Verde', 'S. Acosta', 'N. Paredes', 'Haras Del Valle');

-- Add race entries for Race 3
INSERT INTO race_entries (id, race_id, program_number, horse_name, jockey, trainer, stud) VALUES
('55555555-5555-5555-5555-555555555531', '44444444-4444-4444-4444-444444444443', 1, 'Halcón Peregrino', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
('55555555-5555-5555-5555-555555555532', '44444444-4444-4444-4444-444444444443', 2, 'Sueño Imperial', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
('55555555-5555-5555-5555-555555555533', '44444444-4444-4444-4444-444444444443', 3, 'Llama Eterna', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
('55555555-5555-5555-5555-555555555534', '44444444-4444-4444-4444-444444444443', 4, 'Ola Marina', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
('55555555-5555-5555-5555-555555555535', '44444444-4444-4444-4444-444444444443', 5, 'Sol Invicto', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
('55555555-5555-5555-5555-555555555536', '44444444-4444-4444-4444-444444444443', 6, 'Noche Estrellada', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
('55555555-5555-5555-5555-555555555537', '44444444-4444-4444-4444-444444444443', 7, 'Brisa del Mar', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
('55555555-5555-5555-5555-555555555538', '44444444-4444-4444-4444-444444444443', 8, 'Cosmos Brillante', 'F. Cruz', 'L. Herrera', 'Haras La Pampa'),
('55555555-5555-5555-5555-555555555539', '44444444-4444-4444-4444-444444444443', 9, 'Tempestad Gris', 'S. Acosta', 'N. Paredes', 'Haras Del Valle'),
('55555555-5555-5555-5555-555555555540', '44444444-4444-4444-4444-444444444443', 10, 'Ventisca Polar', 'G. Navarro', 'P. Soto', 'Haras El Cóndor');

-- Add some predictions for Race 1
INSERT INTO predictions (id, race_id, user_id, winner_pick, exacta_pick, tiebreaker_value, is_locked) VALUES
('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000002', 
 '55555555-5555-5555-5555-555555555513', 
 '["55555555-5555-5555-5555-555555555513", "55555555-5555-5555-5555-555555555511"]'::jsonb,
 '1:15.50',
 false),
('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000003', 
 '55555555-5555-5555-5555-555555555511', 
 '["55555555-5555-5555-5555-555555555511", "55555555-5555-5555-5555-555555555512"]'::jsonb,
 '1:16.20',
 false),
('66666666-6666-6666-6666-666666666663', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000004', 
 '55555555-5555-5555-5555-555555555512', 
 '["55555555-5555-5555-5555-555555555512", "55555555-5555-5555-5555-555555555513"]'::jsonb,
 '1:14.80',
 false),
('66666666-6666-6666-6666-666666666664', '44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000005', 
 '55555555-5555-5555-5555-555555555514', 
 '["55555555-5555-5555-5555-555555555514", "55555555-5555-5555-5555-555555555515"]'::jsonb,
 '1:17.00',
 false);

-- User 6 doesn't predict (to test 0 points scenario)

COMMENT ON TABLE profiles IS 'Seeded with 1 admin and 5 regular users';
COMMENT ON TABLE pencas IS 'Seeded with 1 test penca';
COMMENT ON TABLE races IS 'Seeded with 3 races, 1 hour apart';
COMMENT ON TABLE predictions IS 'Seeded with 4 predictions for race 1 (1 user missing)';
