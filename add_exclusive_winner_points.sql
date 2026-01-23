-- Migración: Hacer configurable el valor de puntos por ganador exclusivo
-- Fecha: 2026-01-23
-- 
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard
-- 2. Abre SQL Editor
-- 3. Copia y pega este SQL
-- 4. Ejecuta

-- Agregar columna exclusive_winner_points a la tabla rulesets
ALTER TABLE rulesets 
ADD COLUMN IF NOT EXISTS exclusive_winner_points INTEGER NOT NULL DEFAULT 25;

COMMENT ON COLUMN rulesets.exclusive_winner_points IS 
'Puntos otorgados cuando un caballo ganador fue predicho por una sola persona (exclusiva). Por defecto 25 puntos.';

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
AND column_name = 'exclusive_winner_points';
