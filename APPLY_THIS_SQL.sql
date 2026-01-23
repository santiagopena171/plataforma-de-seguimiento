-- Migración: Agregar soporte para empates y puntos bonus al ganador
-- Fecha: 2026-01-23
-- 
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard
-- 2. Abre SQL Editor
-- 3. Copia y pega este SQL
-- 4. Ejecuta

-- Agregar columna para empates en primer lugar
ALTER TABLE race_results 
ADD COLUMN IF NOT EXISTS first_place_tie BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN race_results.first_place_tie IS 
'Indica si hay empate en el primer lugar. Si es TRUE, los dos primeros elementos de official_order son los ganadores compartidos y no se otorga puntuación de segundo lugar.';

-- Agregar columna para puntos bonus al ganador
ALTER TABLE race_results 
ADD COLUMN IF NOT EXISTS bonus_winner_points INTEGER DEFAULT 0;

COMMENT ON COLUMN race_results.bonus_winner_points IS 
'Puntos extra otorgados al ganador de esta carrera específica. Se suman a los puntos normales que correspondan.';

-- Agregar columna para puntos exclusivos configurables por penca
ALTER TABLE rulesets 
ADD COLUMN IF NOT EXISTS exclusive_winner_points INTEGER NOT NULL DEFAULT 25;

COMMENT ON COLUMN rulesets.exclusive_winner_points IS 
'Puntos otorgados cuando un caballo ganador fue predicho por una sola persona (exclusiva). Por defecto 25 puntos.';

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'race_results' 
AND column_name IN ('first_place_tie', 'bonus_winner_points');

SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
AND column_name = 'exclusive_winner_points';
