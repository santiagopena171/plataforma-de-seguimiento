-- FIX: Arreglar trigger de creación automática de perfiles
-- Ejecuta este script ANTES de crear usuarios

-- 1. Primero eliminamos el trigger existente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Eliminamos la función anterior
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Recreamos la función con mejor manejo de errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Insertar perfil con valores por defecto seguros
    INSERT INTO public.profiles (id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name', 
            NEW.email,
            'Usuario'
        ),
        'user'::user_role  -- Siempre empieza como 'user', cambiarás a 'admin' manualmente
    )
    ON CONFLICT (id) DO NOTHING;  -- Evita errores si ya existe
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log del error pero no fallar la creación del usuario
        RAISE WARNING 'Error creando perfil para usuario %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recreamos el trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 5. Verificar que el trigger existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Trigger reparado. Ahora puedes crear usuarios desde Authentication > Users';
    RAISE NOTICE '📝 Recuerda: todos los usuarios nuevos tendrán role=user por defecto';
    RAISE NOTICE '🔧 Debes cambiar manualmente a admin en Table Editor > profiles';
END $$;
