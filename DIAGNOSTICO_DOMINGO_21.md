# DIAGNÓSTICO: Problema de Puntajes Domingo 21
## Penca: mensual-maronas

---

## 🔴 PROBLEMA IDENTIFICADO

El código en `src/lib/calculateScores.ts` tiene un **BUG DE DOBLE CONTEO** cuando las modalidades `winner` y `place/top3` están habilitadas simultáneamente.

### Descripción del Bug

**Líneas 59-69**: Modalidad WINNER
```typescript
if (modalities.includes('winner') && prediction.winner_pick) {
  if (prediction.winner_pick === officialOrder[0]) {
    const isExclusiveWinner = winnerCounts[officialOrder[0]] === 1
    const points = isExclusiveWinner ? 25 : pointsTop3.first
    breakdown.winner = points
    totalPoints += points  // ← SUMA PUNTOS AQUÍ
  }
}
```

**Líneas 101-130**: Modalidad PLACE/TOP3
```typescript
if (modalities.includes('place') || modalities.includes('top3')) {
  const picks = [
    prediction.winner_pick,  // ← El winner_pick se incluye aquí también
    ...(prediction.exacta_pick || []),
    ...(prediction.trifecta_pick || []),
  ].filter((p, i, arr) => p && arr.indexOf(p) === i)

  for (const pick of picks) {
    if (pick === officialOrder[0]) {
      const isExclusiveWinner = placeWinnerCounts[officialOrder[0]] === 1
      const points = isExclusiveWinner ? 25 : pointsTop3.first
      breakdown.place.push(points)
      totalPoints += points  // ← SUMA PUNTOS OTRA VEZ AQUÍ
    }
  }
}
```

### Impacto

Si un usuario acertó el ganador y ambas modalidades están activas:
- **Modalidad winner**: +15 puntos (o +25 si exclusivo)
- **Modalidad place**: +15 puntos adicionales (o +25 si exclusivo)
- **TOTAL INCORRECTO**: 30 puntos (o 50 si exclusivo)
- **TOTAL ESPERADO**: 15 puntos (o 25 si exclusivo)

---

## 📊 ANÁLISIS DETALLADO

### Ejemplo Real con los Datos de la Imagen

Mirando la tabla "Puntos por Día":
- **Full Moon Cat**: 7 puntos el domingo 21 ✓ (bajo, probablemente no acertó ganador)
- **La Vuelta**: 32 puntos el domingo 21 ⚠️ (muy alto, posible doble conteo)
- **Plaza Colonia**: 4 puntos el domingo 21 ✓ (bajo)
- **Alana**: 11 puntos el domingo 21 ⚠️ (podría ser normal o tener ligero problema)

Los puntajes anormalmente altos (como 32) sugieren que efectivamente hay doble conteo.

### Modalidades Probablemente Activas

Basado en el código y el problema reportado:
```javascript
modalities_enabled: ['winner', 'place'] // o ['winner', 'top3']
```

---

## 🔧 SOLUCIÓN

### Opción 1: Excluir winner_pick de place/top3 cuando winner esté activo

```typescript
if (modalities.includes('place') || modalities.includes('top3')) {
  breakdown.place = []
  
  // Si winner está activo, excluir winner_pick para evitar doble conteo
  const includeWinnerPick = !modalities.includes('winner')
  
  const picks = [
    ...(includeWinnerPick ? [prediction.winner_pick] : []),
    ...(prediction.exacta_pick || []),
    ...(prediction.trifecta_pick || []),
  ].filter((p: any, i: number, arr: any[]) => p && arr.indexOf(p) === i)

  for (const pick of picks) {
    if (pick === officialOrder[0]) {
      const isExclusiveWinner = placeWinnerCounts[officialOrder[0]] === 1
      const points = isExclusiveWinner ? 25 : pointsTop3.first
      breakdown.place.push(points)
      totalPoints += points
    } else if (pick === officialOrder[1]) {
      breakdown.place.push(pointsTop3.second)
      totalPoints += pointsTop3.second
    } else if (pick === officialOrder[2]) {
      breakdown.place.push(pointsTop3.third)
      totalPoints += pointsTop3.third
    } else if (officialOrder[3] && pick === officialOrder[3]) {
      breakdown.place.push(pointsTop3.fourth || 0)
      totalPoints += pointsTop3.fourth || 0
    } else {
      breakdown.place.push(0)
    }
  }
}
```

### Opción 2: Usar modalidades mutuamente exclusivas

Clarificar en las reglas que:
- Si `winner` está activo → NO activar `place/top3`
- Si `place/top3` está activo → NO activar `winner`

---

## ✅ PASOS PARA CORREGIR

1. **Aplicar el fix al código**:
   ```bash
   # Editar src/lib/calculateScores.ts con la corrección
   ```

2. **Identificar las carreras del domingo 21**:
   ```bash
   # Necesitarás conectarte a la base de datos para obtener los IDs
   ```

3. **Recalcular los scores**:
   ```bash
   node scripts/recalc_race.js <raceId_1>
   node scripts/recalc_race.js <raceId_2>
   # ... para cada carrera del domingo 21
   ```

4. **Verificar los resultados**:
   - Los puntajes deberían reducirse aproximadamente a la mitad para quienes acertaron el ganador
   - La tabla debería mostrar valores más razonables en la columna "domingo 21"

---

## 🔍 PROBLEMA SECUNDARIO DETECTADO

### Conteo de Exclusividad Inconsistente

El código usa dos contadores diferentes:

**Para modalidad winner**:
```typescript
winnerCounts[prediction.winner_pick] = (winnerCounts[prediction.winner_pick] || 0) + 1
```

**Para modalidad place/top3**:
```typescript
// Cuenta si el ganador está en cualquier pick del usuario
if (picks.includes(officialOrder[0])) {
  placeWinnerCounts[officialOrder[0]] = (placeWinnerCounts[officialOrder[0]] || 0) + 1
}
```

Esto puede causar que:
- Un ganador sea "exclusivo" en winner (25 pts) pero no en place (15 pts)
- O viceversa

**Recomendación**: Usar un solo método de conteo para mantener consistencia.

---

## 📝 NOTAS ADICIONALES

- El problema afecta SOLO a usuarios que acertaron el ganador
- Los demás puntajes (2do, 3er lugar) deberían estar correctos
- El bug existe desde que se implementó el sistema de doble modalidad
- Todas las carreras con ambas modalidades activas están afectadas, no solo el domingo 21

---

## 🚀 SIGUIENTE ACCIÓN INMEDIATA

1. ¿Confirmas que ambas modalidades (winner + place/top3) están activas en mensual-maronas?
2. ¿Quieres que aplique el fix inmediatamente?
3. ¿Necesitas que inicie Supabase local para recalcular los scores?

