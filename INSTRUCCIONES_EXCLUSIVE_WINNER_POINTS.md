# Migración: Puntos Configurables por Ganador Exclusivo

## Resumen
Se agregó un nuevo campo configurable `exclusive_winner_points` al sistema de reglas de cada penca. Anteriormente, cuando un caballo ganador era predicho por una sola persona (exclusiva), automáticamente recibía 25 puntos. Ahora este valor es configurable por penca.

## Cambios Realizados

### 1. Base de Datos
- ✅ Agregado campo `exclusive_winner_points` a la tabla `rulesets` con valor por defecto de 25
- ✅ Actualizado `SETUP_COMPLETO.sql` con el nuevo campo
- ✅ Actualizados archivos seed (`seed.sql` y `seed_simple.sql`)

### 2. Backend
- ✅ Actualizado tipo TypeScript en `src/types/supabase.ts`
- ✅ Modificado `src/lib/calculateScores.ts` para usar `ruleset.exclusive_winner_points`
- ✅ Actualizado endpoint de creación de pencas: `src/app/api/admin/pencas/create/route.ts`
- ✅ Actualizado endpoint de edición de reglas: `src/app/api/admin/pencas/[slug]/rules/route.ts`
- ✅ Actualizados scripts de recálculo:
  - `recalc_domingo21_local.js`
  - `scripts/fix_domingo21_correct.js`

### 3. Frontend
- ✅ Agregado campo en formulario de configuración: `src/app/admin/penca/[slug]/config/RulesForm.tsx`
- ✅ Mostrar información de bonificación en página de predicciones: `src/app/penca/[slug]/race/[raceId]/predict/page.tsx`

## Instrucciones de Migración

### Paso 1: Aplicar la Migración SQL
Ejecuta el archivo `add_exclusive_winner_points.sql` en Supabase:

```sql
-- Agregar columna exclusive_winner_points a la tabla rulesets
ALTER TABLE rulesets 
ADD COLUMN IF NOT EXISTS exclusive_winner_points INTEGER NOT NULL DEFAULT 25;

COMMENT ON COLUMN rulesets.exclusive_winner_points IS 
'Puntos otorgados cuando un caballo ganador fue predicho por una sola persona (exclusiva). Por defecto 25 puntos.';
```

### Paso 2: Verificar el Cambio
Después de ejecutar la migración, verifica que la columna se haya creado correctamente:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rulesets' 
AND column_name = 'exclusive_winner_points';
```

### Paso 3: Actualizar Pencas Existentes (Opcional)
Si tienes pencas existentes y quieres actualizar sus valores de exclusiva:

```sql
-- Para mantener el valor por defecto de 25 (no requiere acción)
-- Las pencas existentes usarán automáticamente 25 puntos

-- Para cambiar el valor en una penca específica:
UPDATE rulesets 
SET exclusive_winner_points = 30  -- Cambia 30 por el valor deseado
WHERE penca_id = 'TU_PENCA_ID' AND is_active = true;
```

### Paso 4: Desplegar el Código
Una vez aplicada la migración SQL, despliega el código actualizado.

## Cómo Usar

### Para Administradores de Pencas:
1. Ve a la configuración de tu penca: `/admin/penca/[slug]/config`
2. En la sección "Distribución de Puntos", encontrarás un nuevo campo:
   - **"Puntos por ganador exclusivo"**
3. Ingresa el valor deseado (por defecto 25)
4. Guarda los cambios

### Para Jugadores:
- En la página de predicciones, verás la información sobre la bonificación por exclusiva
- Si está configurada diferente al valor de 1° lugar, aparecerá destacada:
  - "✨ Ganador Exclusivo: X puntos (Cuando solo tú aciertas el ganador)"

## Comportamiento

### Modalidad Winner
- Si varias personas aciertan el ganador: cada uno recibe `points_top3.first` puntos
- Si solo UNA persona acierta el ganador: recibe `exclusive_winner_points` puntos

### Modalidad Place/Top3
- Similar al Winner, pero aplicado a cualquier caballo que termine primero
- Si solo UNA persona lo incluyó en sus picks: recibe `exclusive_winner_points` puntos

### Modalidades Exacta/Trifecta
- No se ven afectadas por la bonificación de exclusiva
- Siguen sumando los puntos normales de cada posición

## Compatibilidad hacia Atrás
- ✅ Las pencas existentes automáticamente usarán 25 puntos (valor por defecto)
- ✅ El comportamiento actual se mantiene sin cambios
- ✅ Los cálculos de puntajes previos no se ven afectados

## Notas Técnicas
- El valor debe ser un entero positivo o cero
- Se recomienda que sea igual o mayor a `points_top3.first` para que tenga sentido como "bonificación"
- El campo es obligatorio (NOT NULL) con valor por defecto de 25

## Archivos Modificados
```
Backend:
- supabase/SETUP_COMPLETO.sql
- supabase/seed.sql
- supabase/seed_simple.sql
- src/types/supabase.ts
- src/lib/calculateScores.ts
- src/app/api/admin/pencas/create/route.ts
- src/app/api/admin/pencas/[slug]/rules/route.ts
- recalc_domingo21_local.js
- scripts/fix_domingo21_correct.js

Frontend:
- src/app/admin/penca/[slug]/config/RulesForm.tsx
- src/app/penca/[slug]/race/[raceId]/predict/page.tsx

Migración:
- add_exclusive_winner_points.sql (nuevo)
```
