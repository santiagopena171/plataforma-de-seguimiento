# Migración: Puntos Bonus al Ganador por Carrera

## Resumen
Se agregó la funcionalidad para otorgar puntos extra al ganador de una carrera específica al momento de publicar el resultado. Esto permite dar bonificaciones especiales en carreras importantes.

## Cambios Realizados

### 1. Base de Datos
- ✅ Agregado campo `bonus_winner_points` (INTEGER, DEFAULT 0) a la tabla `race_results`
- ✅ Actualizado `SETUP_COMPLETO.sql` con el nuevo campo
- ✅ Actualizado `APPLY_THIS_SQL.sql` con todas las migraciones pendientes

### 2. Backend
- ✅ Actualizado tipo TypeScript en `src/types/supabase.ts`
- ✅ Modificado `src/lib/calculateScores.ts` para sumar el bonus al ganador:
  - Agregado parámetro `bonusWinnerPoints`
  - El bonus se suma a los puntos del primer lugar en modalidades Winner y Place/Top3
  - Solo se aplica al ganador real (officialOrder[0])
- ✅ Actualizado endpoint `src/app/api/admin/races/[raceId]/publish/route.ts`:
  - Recibe `bonusWinnerPoints` del formulario
  - Lo guarda en `race_results`
  - Lo pasa a `calculateScores`

### 3. Frontend
- ✅ Actualizado formulario de publicación `src/app/admin/penca/[slug]/race/[raceId]/publish/PublishResultForm.tsx`:
  - Checkbox "Otorgar puntos extra al ganador"
  - Campo numérico para ingresar la cantidad de puntos
  - Diseño destacado con fondo ámbar

## Instrucciones de Migración

### Paso 1: Aplicar la Migración SQL
Ejecuta el archivo actualizado `APPLY_THIS_SQL.sql` en Supabase:

```sql
-- Agregar columna para puntos bonus al ganador
ALTER TABLE race_results 
ADD COLUMN IF NOT EXISTS bonus_winner_points INTEGER DEFAULT 0;

COMMENT ON COLUMN race_results.bonus_winner_points IS 
'Puntos extra otorgados al ganador de esta carrera específica. Se suman a los puntos normales que correspondan.';
```

### Paso 2: Verificar el Cambio
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'race_results' 
AND column_name = 'bonus_winner_points';
```

### Paso 3: Desplegar el Código
Una vez aplicada la migración SQL, despliega el código actualizado.

## Cómo Usar

### Para Administradores:
1. Ve a la página de publicación de resultados: `/admin/penca/[slug]/race/[raceId]/publish`
2. Selecciona los primeros 4 lugares
3. **Activa el checkbox** "✨ Otorgar puntos extra al ganador"
4. **Ingresa la cantidad de puntos bonus** (ej: 5, 10, etc.)
5. Publica el resultado

### Comportamiento:

**Modalidad Winner:**
- Si aciertas el ganador: recibes puntos normales (o exclusivos) + bonus
- El bonus SOLO se suma si acertaste el ganador (1er lugar)

**Modalidad Place/Top3:**
- Si tienes al ganador en tus picks: recibes puntos normales (o exclusivos) + bonus
- El bonus SOLO se suma al primer lugar

**Modalidades Exacta/Trifecta:**
- No reciben el bonus (solo modalidades que premian el ganador individual)

### Ejemplos:

**Ejemplo 1: Sin exclusiva, con bonus de 5 puntos**
- Puntos normales 1er lugar: 10
- Bonus: 5
- Total para quien acierte: 15 puntos

**Ejemplo 2: Con exclusiva (25 pts), con bonus de 10 puntos**
- Puntos exclusiva: 25
- Bonus: 10
- Total para el único que acertó: 35 puntos

**Ejemplo 3: Empate en 1er lugar, con bonus de 3 puntos**
- Los dos empatados reciben puntos de 1er lugar (ej: 10)
- SOLO el ganador real (officialOrder[0]) recibe el bonus adicional: 10 + 3 = 13 puntos
- El segundo empatado recibe: 10 puntos (sin bonus)

## Casos de Uso

Esta funcionalidad es útil para:
- **Carreras especiales**: Clásicos, carreras importantes
- **Carreras difíciles**: Cuando hay muchos caballos y es difícil acertar
- **Incentivar participación**: En carreras que históricamente tienen pocas predicciones
- **Premios especiales**: Cumpleaños, eventos especiales

## Notas Técnicas

- El valor debe ser un entero positivo o cero
- Por defecto es 0 (sin bonus)
- Se almacena en `race_results`, no en `rulesets` (es por carrera, no por penca)
- El bonus se suma DESPUÉS de determinar si es exclusiva o no
- Si hay empate en primer lugar, solo el ganador real (officialOrder[0]) recibe el bonus

## Compatibilidad hacia Atrás

- ✅ Carreras existentes tienen `bonus_winner_points = 0` (sin bonus)
- ✅ El comportamiento actual se mantiene sin cambios
- ✅ No afecta cálculos de puntajes previos
- ✅ Opcional: si no activas el checkbox, funciona como siempre

## Archivos Modificados

```
Backend:
- supabase/SETUP_COMPLETO.sql
- src/types/supabase.ts
- src/lib/calculateScores.ts
- src/app/api/admin/races/[raceId]/publish/route.ts

Frontend:
- src/app/admin/penca/[slug]/race/[raceId]/publish/PublishResultForm.tsx

Migración:
- APPLY_THIS_SQL.sql (actualizado con todas las migraciones)
```

## Visualización

Los jugadores verán el impacto del bonus en:
- La tabla de puntajes de la carrera
- El breakdown de puntos en sus perfiles
- El ranking general

El bonus aparece sumado al puntaje total, no se muestra por separado en la UI pública (para simplificar).
