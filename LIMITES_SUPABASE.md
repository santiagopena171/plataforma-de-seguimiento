# LÍMITES IMPORTANTES DE SUPABASE

## 1. Límite de 1000 registros por query (YA RESUELTO)
- **Problema**: `.select()` sin `.range()` solo devuelve 1000 registros
- **Solución aplicada**: Usar paginación con `.range(0, 999)`, `.range(1000, 1999)`, etc.
- **Dónde se aplicó**: 
  - `/public/[slug]/page.tsx` (leaderboard con scores)
  - `/public/[slug]/player/[membershipId]/page.tsx` podría necesitarlo si crece

## 2. Límites de la API de Supabase (CRÍTICO)
### Plan gratuito:
- **500 MB de base de datos**
- **5 GB de ancho de banda mensual**
- **50,000 usuarios activos mensuales**
- **500 MB de storage**
- **2 GB de funciones Edge**

### Límites de rate:
- **10 requests/segundo por IP** (anónimo)
- **100 requests/segundo por usuario autenticado**

## 3. Otros límites técnicos a considerar:

### A. Tamaño de payload
- **Límite de 2 MB por request/response**
- ⚠️ **PROBLEMA POTENCIAL**: Cargar todas las predicciones/scores en una sola query

### B. Límites de PostgreSQL
- **100 conexiones simultáneas** (plan gratuito)
- Queries lentas > 30 segundos timeout

### C. Límites de Next.js
- **50 MB límite de tamaño de página** (incluyendo datos)
- Server Components pueden ser lentos si cargan muchos datos

## 4. LUGARES QUE REVISAR EN TU CÓDIGO:

### ✓ Ya protegidos:
1. `/public/[slug]/page.tsx` - scores (paginado)

### ⚠️ POTENCIALMENTE PROBLEMÁTICOS:

1. **`/debug/race/[raceId]/page.tsx`** (líneas 18-21):
   - Carga predictions, scores, entries SIN límite
   - Si una carrera tiene >1000 participantes, fallará

2. **Cualquier query de `predictions` o `scores` sin `.range()`**
   - Si la penca crece mucho, puede superar 1000 registros

3. **Queries de `race_entries`**
   - Poco probable (raro que una carrera tenga >1000 caballos)
   - Pero mejor estar preparado

## 5. RECOMENDACIONES:

### Inmediatas:
1. ✅ Agregar índices en la base de datos para queries frecuentes
2. ✅ Implementar paginación infinita en el frontend para listas grandes
3. ✅ Usar `.range()` en TODAS las queries que puedan devolver muchos registros

### Mediano plazo:
1. **Monitorear uso de API**: Configurar alertas en Supabase Dashboard
2. **Implementar caching**: Para queries repetitivas (leaderboards, etc.)
3. **Optimizar queries**: Seleccionar solo campos necesarios, no `*`

### Largo plazo (si la penca crece mucho):
1. **Upgrade a plan pago** cuando te acerques a los límites
2. **Implementar Redis** para cache de leaderboards
3. **Considerar worker jobs** para cálculos pesados (en lugar de on-demand)

## 6. CÓMO DETECTAR PROBLEMAS TEMPRANO:

```sql
-- Query para ver cuántos registros tienes por tabla
SELECT 
  schemaname,
  tablename,
  n_live_tup as "Registros"
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Ejecutar regularmente:
```javascript
// Verificar tamaño de queries críticas
const { count } = await supabase
  .from('scores')
  .select('*', { count: 'exact', head: true });
  
console.log('Total scores:', count);
// Si se acerca a 1000, revisar queries
```

## 7. PLAN DE ACCIÓN RECOMENDADO:

1. **Ahora**: Agregar `.range()` a queries en `/debug/race/[raceId]/page.tsx`
2. **Esta semana**: Configurar alertas en Supabase para uso de recursos
3. **Mensual**: Revisar analytics de queries lentas
4. **Trimestral**: Evaluar si necesitas upgrade de plan

---

**RESUMEN**: El límite de 1000 registros es el más común, pero también debes vigilar:
- Ancho de banda mensual
- Tamaño de base de datos  
- Conexiones simultáneas
- Tamaño de payloads individuales
