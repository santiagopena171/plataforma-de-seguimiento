-- Ejemplos de configuración de transmisiones en vivo
-- Ejecuta estos en Supabase SQL Editor DESPUÉS de aplicar la migración

-- IMPORTANTE: Reemplaza 'TU_PENCA_ID_AQUI' con el ID real de tu penca
-- Puedes obtener el ID ejecutando: SELECT id, name, slug FROM pencas;

-- Ejemplo 1: Video específico de YouTube (URL completa)
-- Nota: El sistema ahora acepta URLs completas, pero en la BD se almacenan los IDs extraídos
INSERT INTO live_streams (
  penca_id,
  title,
  description,
  youtube_video_id,  -- Extraído automáticamente de: youtube.com/watch?v=dQw4w9WgXcQ
  is_active,
  display_order
) VALUES (
  'TU_PENCA_ID_AQUI',  -- Reemplazar con tu penca ID
  'Transmisión de Prueba',
  'Video de ejemplo para probar la funcionalidad',
  'dQw4w9WgXcQ',  -- Video de prueba (público y siempre disponible)
  true,
  0
);

-- Ejemplo 2: Transmisión en vivo de un canal
-- Reemplaza 'UCxxxxxxxx' con un Channel ID real extraído de: youtube.com/channel/CHANNEL_ID/live
/*
INSERT INTO live_streams (
  penca_id,
  title,
  description,
  youtube_channel_id,  -- Extraído de: youtube.com/channel/UCxxxxxxxx/live
  is_active,
  display_order
) VALUES (
  'TU_PENCA_ID_AQUI',  -- Reemplazar con tu penca ID
  'Canal en Vivo',
  'Transmisión en vivo del canal oficial',
  'UCxxxxxxxx',  -- Reemplazar con tu Channel ID
  true,
  1
);
*/

-- NOTA: En la interfaz web solo necesitas pegar la URL completa.
-- Estos INSERT son solo para pruebas directas en SQL.

-- Ver todas las transmisiones configuradas
SELECT 
  ls.id,
  p.name as penca_name,
  ls.title,
  ls.youtube_video_id,
  ls.youtube_channel_id,
  ls.is_active,
  ls.display_order,
  ls.created_at
FROM live_streams ls
JOIN pencas p ON p.id = ls.penca_id
ORDER BY ls.display_order;

-- Para eliminar una transmisión de prueba:
-- DELETE FROM live_streams WHERE title = 'Transmisión de Prueba';
