# Guía Completa: Página de Predicciones del Jugador

## Descripción General

La página `/public/[slug]/player/[membershipId]` muestra todas las predicciones de un jugador específico en una penca, junto con los resultados oficiales y los puntos obtenidos en cada carrera.

---

## Problema Crítico: Límite de Carreras Mostradas (Enero 2026)

### Síntomas
- **Localhost**: Solo mostraba hasta la carrera #105-115
- **Vercel**: Mostraba hasta la #139, pero carreras 130-139 decían "sin resultado registrado" (cuando sí lo estaban)
- La cantidad de carreras mostradas variaba según el entorno

### Diagnóstico
1. **Verificación de datos**: Los datos en Supabase estaban correctos (228 carreras totales, 139 publicadas)
2. **Tests de backend**: Las queries con Service Role Client funcionaban correctamente
3. **Causa raíz identificada**: 
   - Las consultas usando `.in('race_id', allRaceIds)` con arrays grandes (>100 elementos) fallan silenciosamente
   - Límite de URL en PostgREST/Supabase: ~100 IDs por query
   - Las queries se cortaban sin error visible, devolviendo solo datos parciales

### Solución: Batching en TODAS las Consultas

**Archivos modificados**: `src/app/public/[slug]/player/[membershipId]/page.tsx`

Se implementó batching (lotes de 100 IDs) en todas las consultas que usan `.in()` con arrays grandes:

#### 1. Race Results (líneas ~62-80)
```typescript
// ANTES (solo obtenía ~115 resultados):
const { data: fetchedResults } = await supabase
  .from('race_results')
  .select('*')
  .in('race_id', allRaceIds); // 228 IDs - EXCEDE LÍMITE

// DESPUÉS (obtiene todos):
const BATCH_SIZE = 100;
const resultsBatches: any[] = [];

for (let i = 0; i < allRaceIds.length; i += BATCH_SIZE) {
  const batch = allRaceIds.slice(i, i + BATCH_SIZE);
  const { data: batchData } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', batch);
  
  if (batchData) {
    resultsBatches.push(...batchData);
  }
}
raceResults = resultsBatches.map((result: any) => normalizeRaceResult(result));
```

#### 2. Predictions (líneas ~107-147)
```typescript
const BATCH_SIZE = 100;

// Buscar por membership_id en lotes
const predictionsBatches: any[] = [];
for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
  const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
  const { data: batchData } = await supabase
    .from('predictions')
    .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
    .eq('membership_id', membership.id)
    .in('race_id', batch);
  if (batchData) {
    predictionsBatches.push(...batchData);
  }
}
predictions = predictionsBatches;

// Fallback por user_id también en lotes
if (predictions.length === 0 && membership.user_id) {
  const fallbackPredictionsBatches: any[] = [];
  for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
    const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
    const { data: batchData } = await supabase
      .from('predictions')
      .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
      .eq('user_id', membership.user_id)
      .in('race_id', batch);
    if (batchData) {
      fallbackPredictionsBatches.push(...batchData);
    }
  }
  predictions = fallbackPredictionsBatches;
}
```

#### 3. Scores (líneas ~149-180)
```typescript
// Mismo patrón: buscar por membership_id en lotes
const scoresBatches: any[] = [];
for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
  const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
  const { data: batchData } = await supabase
    .from('scores')
    .select('id, race_id, points_total, breakdown')
    .eq('membership_id', membership.id)
    .in('race_id', batch);
  if (batchData) {
    scoresBatches.push(...batchData);
  }
}
scores = scoresBatches;

// Fallback también en lotes
if (scores.length === 0 && membership.user_id) {
  // Similar al de predictions
}
```

#### 4. Entries (líneas ~182-195)
```typescript
const entriesBatches: any[] = [];
for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
  const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
  const { data: batchData } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, horse_name:label')
    .in('race_id', batch);
  if (batchData) {
    entriesBatches.push(...batchData);
  }
}
entries = entriesBatches;
```

### Verificación del Fix
1. Limpiar caché: `Remove-Item -Recurse -Force .next`
2. Reiniciar servidor: `npm run dev`
3. Recargar navegador con Ctrl+Shift+R
4. Verificar que muestre todas las 139 carreras

### Lecciones Aprendidas
- ⚠️ **CRÍTICO**: Cualquier query con `.in()` que pueda superar 100 elementos debe usar batching
- El problema era silencioso: no generaba errores visibles, solo devolvía datos parciales
- Afecta tanto a development como production
- La caché de Next.js puede ocultar el fix hasta que se limpia

---

## Problema Original: Resultados Oficiales (Diciembre 2025)

En la página pública de predicciones del jugador, los resultados oficiales de las carreras mostraban "caballo #?" en lugar de los números correctos.

## Diagnóstico

### 1. Verificación de Datos
- Se creó script `debug_race_results.js` que confirmó que los datos en Supabase estaban correctos
- Carrera 104: 🥇 #4, 🥈 #9, 🥉 #12, 4° #10
- Carrera 105: 🥇 #12, 🥈 #2, 🥉 #9, 4° #3

### 2. Análisis de Código
- Se confirmó que la normalización de resultados funcionaba correctamente
- La función `normalizeRaceResult()` transformaba `official_order` array a campos individuales `first_place`, `second_place`, etc.

### 3. Causa Raíz
**El problema era el límite de URL/Query de Supabase:**
- La página intentaba consultar **420 entry IDs** en una sola petición usando `.in()`
- Esto causaba un error `TypeError: fetch failed`
- Las entries de los resultados oficiales nunca se cargaban en el mapa `entryById`

## Solución Implementada

### Consultas en Lotes (Batching)

```typescript
// ANTES (FALLABA):
const { data: resultEntries } = await supabase
  .from('race_entries')
  .select('id, race_id, program_number, horse_name:label')
  .in('id', resultEntryIds); // 420 IDs - EXCEDE LÍMITE

// DESPUÉS (FUNCIONA):
const BATCH_SIZE = 100; // Máximo 100 IDs por consulta
const resultEntriesBatches: any[] = [];

for (let i = 0; i < resultEntryIds.length; i += BATCH_SIZE) {
  const batch = resultEntryIds.slice(i, i + BATCH_SIZE);
  const { data: batchData, error: batchError } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, horse_name:label')
    .in('id', batch);
  
  if (batchData) {
    resultEntriesBatches.push(...batchData);
  }
}
```

## Lógica Completa de Carga

### 1. Normalizar Resultados INMEDIATAMENTE
```typescript
const { data: fetchedResults } = await supabase
  .from('race_results')
  .select('*')
  .in('race_id', allRaceIds);

// Normalizar ANTES de usar los IDs
raceResults = (fetchedResults || []).map((result: any) => normalizeRaceResult(result));
```

### 2. Extraer IDs de Resultados Normalizados
```typescript
const resultEntryIds = Array.from(
  new Set(
    raceResults
      .flatMap((result: any) => [
        result.first_place,
        result.second_place,
        result.third_place,
        result.fourth_place,
      ])
      .filter(Boolean)
  )
);
```

### 3. Consultar Entries en Lotes
```typescript
const BATCH_SIZE = 100;
for (let i = 0; i < resultEntryIds.length; i += BATCH_SIZE) {
  const batch = resultEntryIds.slice(i, i + BATCH_SIZE);
  const { data: batchData } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, horse_name:label')
    .in('id', batch);
  
  if (batchData) {
    entries = entries.concat(batchData);
  }
}
```

### 4. Mapear Entries y Renderizar
```typescript
// Crear mapa de entries
const entryById = new Map<string, any>();
entries.forEach(entry => {
  if (entry) entryById.set(entry.id, entry);
});

// Renderizar resultados oficiales
<li>🥇 caballo #{entryById.get(raceResult.first_place)?.program_number || '?'}</li>
<li>🥈 caballo #{entryById.get(raceResult.second_place)?.program_number || '?'}</li>
<li>🥉 caballo #{entryById.get(raceResult.third_place)?.program_number || '?'}</li>
<li>4° caballo #{entryById.get(raceResult.fourth_place)?.program_number || '?'}</li>
```

## Lecciones Aprendidas

### De ambos problemas:
1. **⚠️ REGLA CRÍTICA**: Cualquier consulta `.in()` con >100 elementos DEBE usar batching
2. **Batching es Obligatorio**: Para consultas con arrays grandes, dividir en lotes de 100
3. **Normalización Temprana**: Normalizar los resultados INMEDIATAMENTE después de obtenerlos de la BD
4. **Debugging con Logs**: Los `console.log` en server-side son clave para identificar problemas
5. **Errores Silenciosos**: Los límites de URL no generan errores, solo devuelven datos parciales
6. **Caché de Next.js**: Limpiar `.next` es necesario para ver cambios críticos

## Aplicación en Otros Lugares

Esta misma lógica de batching debe aplicarse en:
- ✅ `/public/[slug]/player/[membershipId]/page.tsx` - **TODAS las consultas** (IMPLEMENTADO - Enero 2026)
- 🔍 Cualquier otra página que consulte muchos race IDs o entry IDs
- 🔍 Consultas de predicciones cuando hay muchos jugadores
- 🔍 **CUALQUIER** consulta `.in()` con >100 valores

## Referencias

- Archivo principal: `src/app/public/[slug]/player/[membershipId]/page.tsx`
- Scripts de diagnóstico: 
  - `debug_race_results.js` (problema de entries)
  - `debug_race_visibility.js` (problema de límite de carreras)
  - `test_batched_queries.js` (verificación de batching)
- Líneas clave del fix de enero 2026: 62-195 (batching en race_results, predictions, scores, entries)

---

**Resolución Problema 1 (Diciembre 2025)**: 
- **Problema**: Resultados oficiales mostrando "caballo #?"
- **Causa**: Límite de URL en query de entries (420 IDs)
- **Solución**: Batching en consulta de resultEntryIds

**Resolución Problema 2 (Enero 2026)**:
- **Problema**: Solo se mostraban 105-115 carreras de 139 totales
- **Causa**: Límite de URL en TODAS las queries principales (race_results, predictions, scores, entries)
- **Solución**: Batching implementado en TODAS las consultas que usan `.in()` con arrays grandes

---
**Causa**: Límite de Supabase en queries `.in()` con 420 IDs
**Solución**: Implementar batching de consultas (100 IDs por lote)

---

## Lógica Completa de la Página: Carga de Datos

### 1. Obtener Membership y Validaciones

```typescript
// 1.1 Obtener penca por slug
const { data: penca } = await supabase
  .from('pencas')
  .select('id, name')
  .eq('slug', params.slug)
  .single();

// 1.2 Obtener membership con profile del usuario
const { data: membership } = await supabase
  .from('memberships')
  .select(`
    *,
    profiles:user_id (
      display_name
    )
  `)
  .eq('id', params.membershipId)
  .eq('penca_id', penca.id)
  .single();

// 1.3 Validación: No mostrar admins
if (!membership || membership.role === 'admin') {
  notFound();
}

// 1.4 Determinar nombre del jugador
const playerName = 
  membership.guest_name || 
  membership.profiles?.display_name || 
  'Sin nombre';
```

### 2. Obtener Carreras y Resultados

```typescript
// 2.1 Obtener todas las carreras de la penca
const { data: races } = await supabase
  .from('races')
  .select('id, seq, venue, distance_m, start_at, status')
  .eq('penca_id', penca.id)
  .order('seq', { ascending: false });

// 2.2 Obtener race_results
const { data: fetchedResults } = await supabase
  .from('race_results')
  .select('*')
  .in('race_id', allRaceIds);

// 2.3 IMPORTANTE: Normalizar INMEDIATAMENTE
raceResults = (fetchedResults || []).map((result: any) => 
  normalizeRaceResult(result)
);
```

**Función de Normalización:**
```typescript
const normalizeRaceResult = (result: any) => {
  if (!result) return result;
  const order = Array.isArray(result.official_order) ? result.official_order : [];
  const [first, second, third, fourth] = order;
  return {
    ...result,
    first_place: result.first_place || first || null,
    second_place: result.second_place || second || null,
    third_place: result.third_place || third || null,
    fourth_place: result.fourth_place || fourth || null,
  };
};
```

### 3. Filtrar Carreras Publicadas

```typescript
// 3.1 Identificar carreras con resultados
const raceIdsWithResults = new Set(
  raceResults.map((result: any) => result.race_id)
);

// 3.2 Filtrar solo carreras publicadas O con resultados
const publishedRaces = (races || []).filter(
  (race: any) =>
    race.status === 'result_published' || raceIdsWithResults.has(race.id)
);
```

### 4. Obtener Predicciones del Jugador

```typescript
// 4.1 Buscar predicciones por membership_id (prioritario)
const { data: fetchedPredictions } = await supabase
  .from('predictions')
  .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
  .eq('membership_id', membership.id)
  .in('race_id', publishedRaceIds);

predictions = fetchedPredictions || [];

// 4.2 Fallback: buscar por user_id si no hay predicciones
if (predictions.length === 0 && membership.user_id) {
  const { data: fallbackPredictions } = await supabase
    .from('predictions')
    .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
    .eq('user_id', membership.user_id)
    .in('race_id', publishedRaceIds);
  predictions = fallbackPredictions || [];
}
```

**¿Por qué el doble enfoque?**
- Datos antiguos pueden tener solo `user_id`
- Datos nuevos usan `membership_id` (más específico por penca)
- El fallback asegura compatibilidad con datos históricos

### 5. Obtener Scores del Jugador

```typescript
// 5.1 Buscar scores por membership_id (prioritario)
const { data: fetchedScores } = await supabase
  .from('scores')
  .select('id, race_id, points_total, breakdown')
  .eq('membership_id', membership.id)
  .in('race_id', publishedRaceIds);

scores = fetchedScores || [];

// 5.2 Fallback: buscar por user_id si no hay scores
if (scores.length === 0 && membership.user_id) {
  const { data: fallbackScores } = await supabase
    .from('scores')
    .select('id, race_id, points_total, breakdown')
    .eq('user_id', membership.user_id)
    .in('race_id', publishedRaceIds);
  scores = fallbackScores || [];
}
```

### 6. Obtener Entries (Caballos) - PARTE CRÍTICA

```typescript
// 6.1 Obtener entries de las carreras publicadas
const { data: fetchedEntries } = await supabase
  .from('race_entries')
  .select('id, race_id, program_number, horse_name:label')
  .in('race_id', publishedRaceIds);
entries = fetchedEntries || [];

// 6.2 Obtener entries de las PREDICCIONES del jugador
const predictionEntryIds = Array.from(
  new Set(
    predictions
      .flatMap((prediction: any) => [
        prediction.winner_pick,
        ...(prediction.exacta_pick || []),
        ...(prediction.trifecta_pick || []),
      ])
      .filter(Boolean)
  )
);

if (predictionEntryIds.length > 0) {
  const { data: extraEntries } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, horse_name:label')
    .in('id', predictionEntryIds);
  entries = entries.concat(extraEntries || []);
}

// 6.3 Obtener entries de los RESULTADOS OFICIALES - CON BATCHING
const resultEntryIds = Array.from(
  new Set(
    raceResults
      .flatMap((result: any) => [
        result.first_place,
        result.second_place,
        result.third_place,
        result.fourth_place,
      ])
      .filter(Boolean)
  )
);

// ⚠️ IMPORTANTE: Usar batching para evitar límites de Supabase
if (resultEntryIds.length > 0) {
  const BATCH_SIZE = 100;
  const resultEntriesBatches: any[] = [];
  
  for (let i = 0; i < resultEntryIds.length; i += BATCH_SIZE) {
    const batch = resultEntryIds.slice(i, i + BATCH_SIZE);
    const { data: batchData } = await supabase
      .from('race_entries')
      .select('id, race_id, program_number, horse_name:label')
      .in('id', batch);
    
    if (batchData) {
      resultEntriesBatches.push(...batchData);
    }
  }
  
  if (resultEntriesBatches.length > 0) {
    entries = entries.concat(resultEntriesBatches);
  }
}
```

**¿Por qué tres consultas de entries?**
1. **Entries de carreras**: Para tener todos los caballos de las carreras
2. **Entries de predicciones**: Por si el jugador predijo un caballo que ya no existe en la carrera
3. **Entries de resultados**: Para los caballos ganadores (puede ser diferente set)

### 7. Crear Mapas para Renderizado Eficiente

```typescript
// 7.1 Mapas de resultados, predicciones y scores por race_id
const resultsMap = new Map(
  raceResults.map((result: any) => [result.race_id, result])
);

const predictionsMap = new Map(
  predictions.map((prediction: any) => [prediction.race_id, prediction])
);

const scoresMap = new Map(
  scores.map((score: any) => [score.race_id, score])
);

// 7.2 Mapa de entries por ID
const entryById = new Map<string, any>();
entries.forEach((entry) => {
  if (entry) {
    entryById.set(entry.id, entry);
  }
});

// 7.3 Mapa de entries por carrera (para búsquedas más complejas)
type RaceEntriesMaps = {
  byId: Record<string, any>;
  byProgram: Record<string | number, any>;
};

const entriesByRace = new Map<string, RaceEntriesMaps>();
entries.forEach((entry) => {
  if (!entry) return;
  
  if (!entriesByRace.has(entry.race_id)) {
    entriesByRace.set(entry.race_id, { byId: {}, byProgram: {} });
  }
  
  const raceEntries = entriesByRace.get(entry.race_id)!;
  raceEntries.byId[entry.id] = entry;
  raceEntries.byProgram[String(entry.program_number)] = entry;
});
```

### 8. Renderizado en la UI

```tsx
{publishedRaces.map((race: any) => {
  const raceResult = resultsMap.get(race.id);
  const playerPrediction = predictionsMap.get(race.id);
  const playerScore = scoresMap.get(race.id);

  return (
    <div key={race.id}>
      {/* Información de la carrera */}
      <h2>Carrera #{race.seq}</h2>
      <p>{race.venue} • {race.distance_m}m</p>
      
      {/* Resultado Oficial */}
      {raceResult && (
        <ul>
          <li>🥇 caballo #{entryById.get(raceResult.first_place)?.program_number || '?'}</li>
          <li>🥈 caballo #{entryById.get(raceResult.second_place)?.program_number || '?'}</li>
          <li>🥉 caballo #{entryById.get(raceResult.third_place)?.program_number || '?'}</li>
          <li>4° caballo #{entryById.get(raceResult.fourth_place)?.program_number || '?'}</li>
        </ul>
      )}
      
      {/* Predicción del Jugador */}
      {playerPrediction && (
        <div>
          <p>caballo #{entryById.get(playerPrediction.winner_pick)?.program_number || '?'}</p>
          {playerPrediction.exacta_pick && (
            <p>Exacta: {playerPrediction.exacta_pick
              .map((pick: string) => `#${entryById.get(pick)?.program_number || '?'}`)
              .join(' → ')
            }</p>
          )}
        </div>
      )}
      
      {/* Puntos Obtenidos */}
      {playerScore && (
        <div>
          <p>Puntaje: {playerScore.points_total ?? 0} pts</p>
          {playerScore.breakdown && (
            <div>
              {Object.entries(playerScore.breakdown).map(([key, value]) => (
                <span key={key}>
                  {key}: {typeof value === 'number' ? value : JSON.stringify(value)} pts
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
})}
```

## Flujo de Datos Completo

```
1. Obtener Penca (slug)
   ↓
2. Obtener Membership + Profile
   ↓
3. Obtener Races de la Penca
   ↓
4. Obtener Race Results (NORMALIZAR ✓)
   ↓
5. Filtrar Races Publicadas
   ↓
6. Obtener Predictions (membership_id → fallback user_id)
   ↓
7. Obtener Scores (membership_id → fallback user_id)
   ↓
8. Obtener Race Entries (3 consultas):
   - Entries de races
   - Entries de predictions
   - Entries de results (CON BATCHING ✓)
   ↓
9. Crear Mapas (resultsMap, predictionsMap, scoresMap, entryById)
   ↓
10. Renderizar UI
```

## Mejoras Implementadas Recientemente

### ✅ Sistema de Fallback para Predictions y Scores
- **Problema**: Datos históricos usaban `user_id`, datos nuevos usan `membership_id`
- **Solución**: Buscar primero por `membership_id`, si no hay resultados, buscar por `user_id`
- **Beneficio**: Compatibilidad con datos antiguos y nuevos

### ✅ Normalización Inmediata de Resultados
- **Problema**: Algunos resultados usan `official_order` array, otros usan campos individuales
- **Solución**: Función `normalizeRaceResult()` que unifica ambos formatos
- **Beneficio**: Código consistente y predecible

### ✅ Batching de Consultas para Entries
- **Problema**: Consultas con >300 IDs fallaban por límites de Supabase
- **Solución**: Dividir en lotes de 100 IDs
- **Beneficio**: Funciona con cualquier cantidad de datos

### ✅ Triple Consulta de Entries
- **Problema**: Faltan entries en algunos casos (caballos eliminados, etc.)
- **Solución**: Obtener entries de 3 fuentes (races, predictions, results)
- **Beneficio**: Siempre se muestran los números correctos

## Patrones a Seguir en Otras Páginas

### 1. Siempre normalizar Race Results inmediatamente
```typescript
raceResults = fetchedResults.map(normalizeRaceResult);
```

### 2. Usar fallback membership_id → user_id
```typescript
let data = await getBy('membership_id', membershipId);
if (!data.length && userId) {
  data = await getBy('user_id', userId);
}
```

### 3. Usar batching para consultas .in() grandes
```typescript
const BATCH_SIZE = 100;
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  const batch = ids.slice(i, i + BATCH_SIZE);
  // consulta con batch
}
```

### 4. Obtener entries de múltiples fuentes
```typescript
// Entries de races
// + Entries de predictions  
// + Entries de results
// = entries completas
```

---

**Última actualización**: 28 de diciembre de 2025
**Archivo**: `src/app/public/[slug]/player/[membershipId]/page.tsx`
**Líneas clave**: 
- Normalización: 12-23
- Fallback predictions: 100-113
- Fallback scores: 117-130
- Batching entries: 155-177
