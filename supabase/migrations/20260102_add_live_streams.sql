-- Migración: Agregar tabla para gestionar transmisiones en vivo de YouTube por penca
-- Fecha: 2026-01-02

-- Crear tabla para configurar transmisiones en vivo
CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  penca_id uuid NOT NULL REFERENCES pencas(id) ON DELETE CASCADE,
  
  -- Información del stream
  title text NOT NULL,
  description text,
  
  -- ID de YouTube (uno u otro)
  youtube_video_id text, -- ID del video específico (ej: "dQw4w9WgXcQ" de https://youtube.com/watch?v=dQw4w9WgXcQ)
  youtube_channel_id text, -- ID del canal para transmisión en vivo (ej: "UCxxxxxxxx")
  
  -- Control de visibilidad
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  
  -- Metadatos
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Validación: debe tener al menos uno de los IDs
  CONSTRAINT live_streams_youtube_id_check CHECK (
    youtube_video_id IS NOT NULL OR youtube_channel_id IS NOT NULL
  )
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_live_streams_penca_id ON live_streams(penca_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_is_active ON live_streams(is_active);
CREATE INDEX IF NOT EXISTS idx_live_streams_display_order ON live_streams(penca_id, display_order);
 
-- RLS (Row Level Security) policies
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si ya existen (para re-ejecución)
DROP POLICY IF EXISTS "Streams are publicly viewable" ON live_streams;
DROP POLICY IF EXISTS "Penca admins can manage streams" ON live_streams;

-- Cualquiera puede ver los streams activos
CREATE POLICY "Streams are publicly viewable"
  ON live_streams
  FOR SELECT
  USING (is_active = true);

-- Solo admins de la penca pueden crear/editar/eliminar streams
CREATE POLICY "Penca admins can manage streams"
  ON live_streams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM memberships
      WHERE memberships.penca_id = live_streams.penca_id
        AND memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_live_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS live_streams_updated_at ON live_streams;

CREATE TRIGGER live_streams_updated_at
  BEFORE UPDATE ON live_streams
  FOR EACH ROW
  EXECUTE FUNCTION update_live_streams_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE live_streams IS 'Configuración de transmisiones en vivo de YouTube por penca';
COMMENT ON COLUMN live_streams.youtube_video_id IS 'ID del video de YouTube (de la URL youtube.com/watch?v=ID)';
COMMENT ON COLUMN live_streams.youtube_channel_id IS 'ID del canal de YouTube para stream en vivo';
COMMENT ON COLUMN live_streams.display_order IS 'Orden de visualización (menor número = más arriba)';
