# INSTRUCCIONES PARA APLICAR MIGRACIÓN

## Problema identificado:
La tabla `predictions` tiene un constraint `UNIQUE (race_id, user_id)`, pero ahora estamos usando `membership_id` para invitados. Cuando insertamos predicciones con `user_id = NULL`, todas las predicciones tienen la misma combinación `(race_id, NULL)` y PostgreSQL solo guarda la última.

## Solución:
Cambiar el constraint único para que funcione tanto con `user_id` como con `membership_id`.

## Pasos para aplicar:

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard/project/jvsejwjvhhzjuxcrhunk
2. Navega a "SQL Editor" en el menú lateral
3. Crea una nueva query
4. Copia y pega el siguiente SQL:

```sql
-- Fix predictions unique constraint to work with both user_id and membership_id

-- Drop old unique constraint on (race_id, user_id)
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_race_id_user_id_key;

-- Add unique constraint for race_id + user_id when user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS predictions_race_user_unique
ON predictions(race_id, user_id)
WHERE user_id IS NOT NULL;

-- Add unique constraint for race_id + membership_id when membership_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS predictions_race_membership_unique
ON predictions(race_id, membership_id)
WHERE membership_id IS NOT NULL;
```

5. Haz clic en "Run" (o presiona Ctrl+Enter)
6. Verifica que no haya errores

## Después de aplicar la migración:

1. Elimina todas las predicciones actuales (que son solo 1 por carrera):
   ```sql
   DELETE FROM predictions WHERE race_id IN (
     SELECT id FROM races WHERE penca_id IN (
       SELECT id FROM pencas WHERE slug = 'prueba-nueva'
     )
   );
   ```

2. Vuelve a la aplicación y sube el Excel nuevamente

3. Ahora deberías ver las 64 predicciones guardadas correctamente (8 jugadores × 8 carreras)
