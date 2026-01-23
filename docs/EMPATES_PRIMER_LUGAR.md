# Empates en Primer Lugar

## Descripción

Esta funcionalidad permite registrar carreras donde dos caballos empatan en el primer puesto. Cuando hay un empate en primer lugar:

1. **Dos caballos reciben puntos de primer lugar**: Ambos caballos empatados obtienen la puntuación completa del primer puesto
2. **No se otorga puntuación de segundo lugar**: El siguiente caballo después del empate recibe puntuación de tercer lugar
3. **Modalidades afectadas**:
   - **Winner/Place**: Los jugadores que acertaron cualquiera de los dos ganadores reciben puntos de primer lugar
   - **Exacta/Trifecta**: No se otorgan puntos en estas modalidades cuando hay empate

## Uso en el Admin

### Al Publicar Resultado

1. Ir a la página de publicación de resultado de una carrera
2. Marcar el checkbox **"Empate en primer lugar"**
3. Seleccionar los dos caballos que empataron en las primeras dos posiciones
4. Seleccionar el tercer y cuarto lugar normalmente
5. El sistema mostrará:
   - Ambos primeros caballos con 🥇 y posición "1°"
   - El tercer caballo con 🥉 y posición "3°" (sin segundo lugar)

### Cálculo de Puntos

**Ejemplo con puntos_top3: {first: 5, second: 3, third: 1, fourth: 0}**

**Sin empate:**
- 1° lugar: 5 puntos
- 2° lugar: 3 puntos  
- 3° lugar: 1 punto
- 4° lugar: 0 puntos

**Con empate en primer lugar:**
- 1° lugar (empate): 5 puntos (ambos caballos)
- 2° lugar: **No se otorga**
- 3° lugar: 1 punto
- 4° lugar: 0 puntos

## Implementación Técnica

### Base de Datos

Se agregó el campo `first_place_tie` a la tabla `race_results`:

```sql
ALTER TABLE race_results 
ADD COLUMN first_place_tie BOOLEAN DEFAULT FALSE;
```

### Estructura de Datos

Cuando hay empate:
- `first_place_tie`: `true`
- `official_order`: `[caballo_empatado_1, caballo_empatado_2, tercer_lugar, cuarto_lugar]`

### Archivos Modificados

1. **Migración SQL**: `supabase/migrations/20260112_add_first_place_tie.sql`
2. **Formulario de publicación**: `src/app/admin/penca/[slug]/race/[raceId]/publish/PublishResultForm.tsx`
3. **API de publicación**: `src/app/api/admin/races/[raceId]/publish/route.ts`
4. **Cálculo de puntos**: 
   - `src/lib/calculateScores.ts`
   - `supabase/functions/publish-result/index.ts`
   - `supabase/functions/recalculate-scores/index.ts`
5. **Visualización de resultados**:
   - `src/app/penca/[slug]/page.tsx`
   - `src/components/RacesTabContent.tsx`
6. **Types**: `src/types/supabase.ts`

## Consideraciones

- **Exclusividad**: El sistema de "ganador exclusivo" sigue aplicando solo cuando UN jugador acertó. El valor de puntos es configurable por penca en `ruleset.exclusive_winner_points` (por defecto 25 puntos)
- **Retrocompatibilidad**: Las carreras sin empate siguen funcionando normalmente con `first_place_tie: false`
- **Recálculo**: La función de recálculo de puntos respeta el flag de empate al recalcular scores
