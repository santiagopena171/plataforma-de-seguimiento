-- Permitir que usuarios autenticados puedan ver pencas abiertas (open)
-- Esto es necesario para que puedan unirse usando el código/slug
CREATE POLICY "Anyone can view open pencas"
    ON pencas FOR SELECT
    USING (
        status = 'open' AND auth.uid() IS NOT NULL
    );
