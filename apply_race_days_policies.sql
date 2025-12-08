-- ====================================
-- POLÍTICAS RLS PARA race_days
-- Ejecuta este SQL en Supabase Dashboard
-- ====================================

-- 1. Habilitar RLS en la tabla
ALTER TABLE race_days ENABLE ROW LEVEL SECURITY;

-- 2. Permitir que los miembros vean los días de sus pencas
CREATE POLICY "Members can view race days"
ON race_days FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.penca_id = race_days.penca_id
        AND memberships.user_id = auth.uid()
    )
);

-- 3. Permitir que los admins inserten días
CREATE POLICY "Admins can insert race days"
ON race_days FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.penca_id = race_days.penca_id
        AND memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
    )
);

-- 4. Permitir que los admins actualicen días
CREATE POLICY "Admins can update race days"
ON race_days FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.penca_id = race_days.penca_id
        AND memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
    )
);

-- 5. Permitir que los admins eliminen días
CREATE POLICY "Admins can delete race days"
ON race_days FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.penca_id = race_days.penca_id
        AND memberships.user_id = auth.uid()
        AND memberships.role = 'admin'
    )
);
