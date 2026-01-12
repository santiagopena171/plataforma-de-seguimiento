-- Migración: Agregar soporte para empates en primer lugar
-- Fecha: 2026-01-12
-- 
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard
-- 2. Abre SQL Editor
-- 3. Copia y pega este SQL
-- 4. Ejecuta

ALTER TABLE race_results 
ADD COLUMN IF NOT EXISTS first_place_tie BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN race_results.first_place_tie IS 
'Indica si hay empate en el primer lugar. Si es TRUE, los dos primeros elementos de official_order son los ganadores compartidos y no se otorga puntuación de segundo lugar.';

-- Verificar que la columna se creó correctamente
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'race_results' 
AND column_name = 'first_place_tie';
