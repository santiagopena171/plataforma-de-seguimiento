-- Agregar columna racetrack_id a la tabla pencas
-- Ejecutar este SQL en el dashboard de Supabase (SQL Editor)
-- Permite guardar el ID del hipódromo específico para la sincronización automática

ALTER TABLE pencas
ADD COLUMN IF NOT EXISTS racetrack_id INTEGER DEFAULT NULL;

COMMENT ON COLUMN pencas.racetrack_id IS 'ID del hipódromo en la API X-Turf para filtrar resultados en la sincronización automática. Si es NULL se usa auto-detección.';
