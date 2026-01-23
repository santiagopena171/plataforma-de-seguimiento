--- Seed simplificado SIN usuarios ficticios
-- Solo crea estructuras de datos de ejemplo
-- Ejecuta este DESPUÉS de crear tu usuario admin real

-- Limpia datos previos (por si lo ejecutas múltiples veces)
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

-- ⚠️ REEMPLAZA ESTE ID CON EL ID DE TU USUARIO ADMIN REAL
-- Para obtenerlo: Table Editor > profiles > copia el valor de la columna 'id'
-- Ejemplo: '12345678-1234-1234-1234-123456789abc'
DO $$
DECLARE
  admin_user_id UUID;
  test_penca_id UUID := '11111111-1111-1111-1111-111111111111';
  test_ruleset_id UUID := '22222222-2222-2222-2222-222222222222';
  race1_id UUID := '44444444-4444-4444-4444-444444444441';
  race2_id UUID := '44444444-4444-4444-4444-444444444442';
  race3_id UUID := '44444444-4444-4444-4444-444444444443';
BEGIN
  -- Obtener el primer usuario admin que existe
  SELECT id INTO admin_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario admin. Crea uno primero en Authentication > Users';
  END IF;

  -- Crear penca de prueba
  INSERT INTO pencas (id, slug, name, description, status, created_by) VALUES
  (test_penca_id, 'penca-prueba', 'Penca de Prueba', 'Penca de ejemplo para testing', 'open', admin_user_id);

  -- Agregar admin como administrador de la penca
  INSERT INTO penca_admins (penca_id, user_id) VALUES
  (test_penca_id, admin_user_id);

  -- Crear ruleset para la penca
  INSERT INTO rulesets (id, penca_id, version, points_top3, modalities_enabled, tiebreakers_order, lock_minutes_before_start, sealed_predictions_until_close, effective_from_race_seq, exclusive_winner_points, is_active) VALUES
  (test_ruleset_id, test_penca_id, 1, 
  '{"first": 5, "second": 3, "third": 1}'::jsonb, 
  '["winner", "exacta"]'::jsonb, 
  '[]'::jsonb, 
  15, 
  true, 
  1,
  25,
  true);

  -- Actualizar penca con ruleset activo
  UPDATE pencas SET rules_version_active = 1 WHERE id = test_penca_id;

  -- Crear membresía del admin (para que pueda ver la penca como player también)
  INSERT INTO memberships (penca_id, user_id, role) VALUES
  (test_penca_id, admin_user_id, 'player');

  -- Crear código de invitación
  INSERT INTO invites (id, penca_id, code, expires_at, max_uses, uses, created_by) VALUES
  (gen_random_uuid(), test_penca_id, 'TESTCODE123', NOW() + INTERVAL '30 days', 10, 0, admin_user_id);

  -- Crear 3 carreras (1 hora de distancia)
  INSERT INTO races (id, penca_id, seq, venue, distance_m, track_condition, start_at, status) VALUES
  (race1_id, test_penca_id, 1, 'Hipódromo de Palermo', 1200, 'Buena', NOW() + INTERVAL '2 hours', 'scheduled'),
  (race2_id, test_penca_id, 2, 'Hipódromo de Palermo', 1400, 'Buena', NOW() + INTERVAL '3 hours', 'scheduled'),
  (race3_id, test_penca_id, 3, 'Hipódromo de Palermo', 1600, 'Buena', NOW() + INTERVAL '4 hours', 'scheduled');

  -- Agregar ejemplares para Carrera 1
  INSERT INTO race_entries (race_id, program_number, horse_name, jockey, trainer, stud) VALUES
  (race1_id, 1, 'Rayo de Luna', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
  (race1_id, 2, 'Trueno Negro', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
  (race1_id, 3, 'Viento del Sur', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
  (race1_id, 4, 'Estrella Fugaz', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
  (race1_id, 5, 'Relámpago Azul', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
  (race1_id, 6, 'Sombra Veloz', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
  (race1_id, 7, 'Fuego Salvaje', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
  (race1_id, 8, 'Oro Negro', 'F. Cruz', 'L. Herrera', 'Haras La Pampa');

  -- Agregar ejemplares para Carrera 2
  INSERT INTO race_entries (race_id, program_number, horse_name, jockey, trainer, stud) VALUES
  (race2_id, 1, 'Cometa Dorado', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
  (race2_id, 2, 'Luna Plateada', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
  (race2_id, 3, 'Rey del Viento', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
  (race2_id, 4, 'Príncipe Negro', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
  (race2_id, 5, 'Águila Real', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
  (race2_id, 6, 'Diamante Azul', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
  (race2_id, 7, 'Tornado Rojo', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
  (race2_id, 8, 'Centella Blanca', 'F. Cruz', 'L. Herrera', 'Haras La Pampa'),
  (race2_id, 9, 'Rayo Verde', 'S. Acosta', 'N. Paredes', 'Haras Del Valle');

  -- Agregar ejemplares para Carrera 3
  INSERT INTO race_entries (race_id, program_number, horse_name, jockey, trainer, stud) VALUES
  (race3_id, 1, 'Halcón Peregrino', 'J. Gómez', 'M. Fernández', 'Haras El Sol'),
  (race3_id, 2, 'Sueño Imperial', 'P. Silva', 'R. Torres', 'Haras La Estrella'),
  (race3_id, 3, 'Llama Eterna', 'A. Benítez', 'C. Morales', 'Haras Don Juan'),
  (race3_id, 4, 'Ola Marina', 'L. Ramírez', 'F. Castro', 'Haras Victoria'),
  (race3_id, 5, 'Sol Invicto', 'M. Ortiz', 'J. Vargas', 'Haras Los Andes'),
  (race3_id, 6, 'Noche Estrellada', 'D. Méndez', 'A. Ríos', 'Haras San Jorge'),
  (race3_id, 7, 'Brisa del Mar', 'R. Paz', 'H. Gutiérrez', 'Haras El Puma'),
  (race3_id, 8, 'Cosmos Brillante', 'F. Cruz', 'L. Herrera', 'Haras La Pampa'),
  (race3_id, 9, 'Tempestad Gris', 'S. Acosta', 'N. Paredes', 'Haras Del Valle'),
  (race3_id, 10, 'Ventisca Polar', 'G. Navarro', 'P. Soto', 'Haras El Cóndor');

  RAISE NOTICE 'Seed completado exitosamente para el usuario admin: %', admin_user_id;
  RAISE NOTICE 'Penca creada con ID: %', test_penca_id;
  RAISE NOTICE 'Código de invitación: TESTCODE123';
END $$;

-- Verificar resultados
SELECT 'Pencas creadas:' as tipo, COUNT(*) as cantidad FROM pencas
UNION ALL
SELECT 'Carreras creadas:', COUNT(*) FROM races
UNION ALL
SELECT 'Ejemplares totales:', COUNT(*) FROM race_entries
UNION ALL
SELECT 'Invitaciones activas:', COUNT(*) FROM invites;
