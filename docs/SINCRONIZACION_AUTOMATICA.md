# Sincronización Automática — Documentación Técnica

## Descripción General

La sincronización automática descarga el Excel de resultados de X-Turf, parsea las posiciones y retirados de cada carrera, y publica los resultados llamando a la Edge Function `publish-result`, que calcula y guarda los puntajes de cada jugador.

---

## Archivos Involucrados

| Archivo | Rol |
|---------|-----|
| `src/app/api/cron/sync-all/route.ts` | Cron trigger: decide qué pencas sincronizar y envía notificación Telegram |
| `src/lib/services/sync-results.ts` | Lógica principal: descarga Excel, parsea resultados, llama a Edge Function |
| `supabase/functions/publish-result/index.ts` | Edge Function: calcula puntajes y los guarda en la DB |

---

## Flujo Completo

### 1. Trigger del Cron (`sync-all/route.ts`)

**Invocado por:** cron-job.org cada 15 minutos vía `GET /api/cron/sync-all`

El cron hace lo siguiente:

1. Obtiene todas las pencas con `sync_interval_minutes > 0` y `external_results_url` no nulo.
2. Para cada penca, calcula cuántos minutos pasaron desde `last_sync_at`.
3. Si pasaron ≥ `sync_interval_minutes` minutos:
   - **Escribe `last_sync_at = now()` ANTES de correr el sync** (así el intervalo se respeta aunque el sync falle).
   - Llama a `syncPencaResults(slug, isForce=true)`.
4. Si el sync es exitoso, envía la imagen de resumen diario a Telegram (con cache-buster `?t=Date.now()`).
5. Si el sync falla, envía un mensaje de error a Telegram.

> **Nota sobre el intervalo:** El cron externo se ejecuta cada 15 min siempre, pero el código interno solo procesa una penca si pasó el tiempo configurado. Esto permite tener pencas con intervalos de 30, 60 o 120 minutos sin cambiar el cron externo.

---

### 2. Servicio de Sync (`sync-results.ts`)

#### 2.1 Obtener configuración de la penca

Consulta la tabla `pencas` para obtener:
- `external_results_url`: URL de la página de resultados de Maroñas.
- `racetrack_id`: ID del hipódromo fijo (si está configurado). Si es `null`, se auto-detecta.

#### 2.2 Descarga del Excel (`fetchExcel`)

La URL configurada apunta a la página web de Maroñas (`hipica.maronas.com.uy/RacingInfo/RacingDate?RacingDate=YYYY-MM-DD`). El sistema extrae el parámetro `RacingDate` y construye la URL directa de la API de X-Turf:

```
https://mobile-rest-services-v3.azurewebsites.net//XTurfResourcesService.svc/GetRacingDocument
  ?docType=ResultadoCarreraWeb
  &racetrackId={id}
  &date={YYYY-MM-DD}
  &periodId=0&raceNum=0&language=es-UY&docOrd=0&exportFormat=ExcelRecord
```

**Selección del hipódromo:**
- Si `racetrack_id` está configurado en la penca → prueba **solo ese ID**.
- Si no está configurado → cicla por la lista `[1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20]` y usa el primer ID que devuelva un archivo > 1000 bytes.

#### 2.3 Parseo del Excel (`parseResults`)

Convierte el workbook en un array de filas y recorre línea a línea:

**Detección de inicio de carrera:**
```
"1ª Carrera, Nro. XXXXX, ..."  →  currentRaceSeq = 1
"2ª Carrera, ..."               →  currentRaceSeq = 2
...
```

**Para cada fila de caballo detecta:**

1. **Posición** — busca el patrón `Nº` (ej: `1º`, `2º`) en las columnas 0-2.
   - Si `posición ≤ 4` → guarda en `parsedRaces[carrera][posición]`.
   - Si `posición > 4` → `hasAnyPosition = true` pero no la almacena.

2. **Número de programa** — busca patrón `(N)` en columna 2 o 1 (ej: `(2)` → caballo #2).

3. **Dividendo (columna 13)** — solo se captura para el **primer caballo en posición 1**. En carreras con empate en 1°, el segundo caballo empatado no sobreescribe el dividendo.

4. **Retirados (scratched)** — un caballo se marca como retirado cuando:
   - La columna de posición contiene `RET`, `S/C`, `NP`, `DNF`, `FS` o `FF` (sin número de posición), **O**
   - El texto completo de la fila coincide con el regex:
     ```
     /retiro|retirado|\bret\b|ret\.|s\/c|sc\b|no corre|no corri|no particip|\bnp\b|\bdnf\b|\bfs\b|\bff\b/
     ```

**Estructura de salida por carrera:**
```js
{
  1: [2],          // caballos en 1° lugar (puede ser >1 si hay empate)
  2: [10],         // 2° lugar
  3: [13],         // 3° lugar
  4: [12],         // 4° lugar
  scratched: [1, 4], // retirados
  dividend: 14.8   // dividendo del ganador
}
```

**Empate en 1° lugar:**
- Si `posiciones[1].length > 1` → `isFirstPlaceTie = true`.
- El 3° lugar puede venir en posición `[2]`, `[3]` o `[4]` según el hipódromo:
  ```ts
  const thirdPlaceNum = positions[2]?.[0] ?? positions[3]?.[0] ?? null;
  ```

#### 2.4 Procesamiento por carrera

Para cada carrera encontrada en el Excel:

1. Busca la carrera en la DB por `penca_id` + `seq`.
2. Si la carrera no existe → la saltea.
3. Si `status === 'result_published'` y **no es force** → la saltea.
4. Mapea los números de programa a UUIDs de `race_entries`.
5. Construye `official_order` (array de UUIDs) y `scratched_entries` (array de UUIDs).
6. Llama a la Edge Function `publish-result`.

---

### 3. Edge Function `publish-result`

Recibe:
```json
{
  "race_id": "uuid",
  "official_order": ["uuid_1°", "uuid_2°", "uuid_3°", "uuid_4°"],
  "first_place_tie": false,
  "scratched_entries": ["uuid_ret1", "uuid_ret2"],
  "winner_dividend": 14.8,
  "notes": "..."
}
```

#### 3.1 Ciclado de predicciones con retirados (`getActiveEntry`)

Para cada caballo en la predicción de un jugador, si ese caballo está en `scratched_entries`, se reemplaza por el **siguiente caballo disponible en orden de número de programa** que no esté retirado.

- El campo real de caballos se determina por el máximo `program_number` entre `official_order` + `scratched_entries` — evita ciclar a caballos ficticios que el sistema crea como placeholders.
- Si todos los caballos de reemplazo también están retirados, el ciclo tiene un `loopGuard` para evitar bucles infinitos.

Ejemplo:
```
Jugador predijo #1 → #1 retirado → cicla a #2 (siguiente en orden)
```

#### 3.2 Lógica de Exclusivo y Batacazo

Se calcula sobre los `resolved_winner_pick` **después del ciclado**:

```
exactWinnerGuesserCount = cantidad de jugadores cuya predicción resuelta apunta al ganador
isExclusive = (exactWinnerGuesserCount === 1)
```

| Condición | Puntos por 1° lugar |
|-----------|---------------------|
| Exclusivo (`isExclusive = true`) | `exclusive_winner_points` del ruleset (ej: 30) |
| Batacazo (`!isExclusive` y `dividend ≥ 8`) | `points_top3.first + 7` (ej: 13+7=20) |
| Normal | `points_top3.first` (ej: 13) |

> Si el jugador predijo #1 (retirado) y #1 cicla a #2 (ganador), ese jugador **cuenta como ganador** para el cálculo de exclusivo/batacazo.

#### 3.3 Cálculo de puntos por modalidad

La penca puede tener una o más modalidades activas (`lugar`, `ganador`, `exacta`, `trifecta`):

- **`lugar` / `place`:** Puntaje por cada pick que quedó en top 4. Si el jugador acertó el ganador recibe `firstPlacePoints` (que ya incorpora exclusivo o batacazo). Segundo: `points_top3.second`. Tercero: `points_top3.third`. Cuarto: `points_top3.fourth`.
- **`ganador` / `winner`:** Puntaje solo por acertar el 1°.
- **`exacta`:** Puntaje si acertó 1° y 2° en orden exacto. No aplica si hay empate en 1°.
- **`trifecta`:** Puntaje si acertó 1°, 2° y 3° en orden exacto. No aplica si hay empate en 1°.

#### 3.4 Guardado

- Borra scores anteriores de esa carrera para cada jugador (`DELETE` por `race_id` + `membership_id`).
- Inserta el nuevo score con `points_total` y `breakdown` detallado.
- Registra en `audit_log` el resultado publicado (incluyendo `scratched_entries` y `winner_dividend`).

---

## Variables de Entorno Necesarias

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role para bypass de RLS |
| `TELEGRAM_BOT_TOKEN` | Token del bot `@Pencashipicasbot` |
| `TELEGRAM_CHAT_ID` | ID del chat destino (`5695426761`) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app para construir la imagen |

---

## Diagrama de Flujo Resumido

```
cron-job.org (cada 15 min)
    │
    ▼
GET /api/cron/sync-all
    │
    ├─ Para cada penca con sync activo:
    │       ¿pasaron >= sync_interval_minutes?
    │       ├── NO → skipped
    │       └── SÍ:
    │           ├─ last_sync_at = now()  ← escrito ANTES del sync
    │           ├─ fetchExcel(url, racetrack_id)
    │           │       └─ Descarga X-Turf API con ID fijo o auto-detectado
    │           ├─ parseResults(workbook)
    │           │       ├─ Detecta carreras ("Nª Carrera")
    │           │       ├─ Detecta posiciones (Nº en col 0-2)
    │           │       ├─ Detecta retirados (RET/S/C/NP/etc)
    │           │       └─ Captura dividendo (solo 1er caballo en pos 1)
    │           ├─ Para cada carrera parseada:
    │           │       └─ POST /functions/v1/publish-result
    │           │               ├─ Cicla predicciones con retirados
    │           │               ├─ Calcula exclusivo / batacazo
    │           │               ├─ Calcula puntos por modalidad
    │           │               └─ UPSERT scores + audit_log
    │           └─ Telegram: envía imagen de resumen (éxito) o texto de error
    │
    └─ Response JSON con resultados por penca
```
