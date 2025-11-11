# API Documentation - Pencas Hípicas

## Base URL

- **Local**: `http://localhost:54321/functions/v1`
- **Production**: `https://[your-project].supabase.co/functions/v1`

## Authentication

All endpoints require a valid Supabase JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Edge Functions

### 1. Create Penca

**Endpoint**: `POST /create-penca`

**Auth**: Required (admin role)

**Request Body**:
```json
{
  "name": "Mi Penca 2024",
  "slug": "mi-penca-2024",
  "description": "Penca de amigos",
  "initial_ruleset": {
    "points_top3": {
      "first": 5,
      "second": 3,
      "third": 1
    },
    "modalities_enabled": ["winner", "exacta"],
    "tiebreakers_order": [],
    "lock_minutes_before_start": 15,
    "sealed_predictions_until_close": true
  }
}
```

**Response**:
```json
{
  "penca": {
    "id": "uuid",
    "name": "Mi Penca 2024",
    "slug": "mi-penca-2024",
    "status": "draft",
    "created_by": "user-uuid"
  },
  "ruleset": {
    "id": "uuid",
    "version": 1,
    "is_active": true
  }
}
```

---

### 2. Add Race Batch

**Endpoint**: `POST /add-race-batch`

**Auth**: Required (penca admin)

**Request Body**:
```json
{
  "penca_id": "uuid",
  "races": [
    {
      "seq": 1,
      "venue": "Hipódromo de Palermo",
      "distance_m": 1200,
      "track_condition": "Buena",
      "start_at": "2024-12-01T18:00:00Z",
      "entries": [
        {
          "program_number": 1,
          "horse_name": "Rayo de Luna",
          "jockey": "J. Gómez",
          "trainer": "M. Fernández",
          "stud": "Haras El Sol"
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "races": [
    {
      "id": "uuid",
      "seq": 1,
      "venue": "Hipódromo de Palermo",
      "start_at": "2024-12-01T18:00:00Z",
      "status": "scheduled"
    }
  ]
}
```

---

### 3. Close Predictions

**Endpoint**: `POST /close-predictions`

**Auth**: Required (penca admin)

**Request Body**:
```json
{
  "race_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "race_id": "uuid"
}
```

---

### 4. Publish Result

**Endpoint**: `POST /publish-result`

**Auth**: Required (penca admin)

**Request Body**:
```json
{
  "race_id": "uuid",
  "official_order": [
    "entry-uuid-1",
    "entry-uuid-2",
    "entry-uuid-3"
  ],
  "notes": "Carrera sin incidentes"
}
```

**Response**:
```json
{
  "success": true,
  "race_id": "uuid"
}
```

**Note**: This endpoint automatically calculates and updates scores for all predictions.

---

### 5. Recalculate Scores

**Endpoint**: `POST /recalculate-scores`

**Auth**: Required (penca admin)

**Request Body** (Option A - Single Race):
```json
{
  "race_id": "uuid"
}
```

**Request Body** (Option B - Entire Penca):
```json
{
  "penca_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "recalculated_count": 3
}
```

---

### 6. Join with Code

**Endpoint**: `POST /join-with-code`

**Auth**: Required (any authenticated user)

**Request Body**:
```json
{
  "code": "TESTCODE123"
}
```

**Response**:
```json
{
  "success": true,
  "penca": {
    "id": "uuid",
    "name": "Mi Penca 2024",
    "slug": "mi-penca-2024"
  }
}
```

**Error Responses**:
- `404`: Invalid invite code
- `400`: Invite expired or max uses reached
- `400`: Already a member

---

## Database Functions (RPC)

### is_penca_admin

Check if a user is an admin of a penca.

```typescript
const { data } = await supabase.rpc('is_penca_admin', {
  penca_id_param: 'penca-uuid',
  user_id_param: 'user-uuid'
})
// Returns: boolean
```

### is_penca_member

Check if a user is a member of a penca.

```typescript
const { data } = await supabase.rpc('is_penca_member', {
  penca_id_param: 'penca-uuid',
  user_id_param: 'user-uuid'
})
// Returns: boolean
```

### is_prediction_locked

Check if predictions are locked for a race.

```typescript
const { data } = await supabase.rpc('is_prediction_locked', {
  race_id_param: 'race-uuid'
})
// Returns: boolean
```

---

## Views

### penca_leaderboard

Get aggregated scores for a penca.

```typescript
const { data } = await supabase
  .from('penca_leaderboard')
  .select('*')
  .eq('penca_id', 'penca-uuid')
  .order('total_points', { ascending: false })
```

### upcoming_races

Get scheduled races with metadata.

```typescript
const { data } = await supabase
  .from('upcoming_races')
  .select('*')
  .order('start_at', { ascending: true })
  .limit(10)
```

---

## Realtime Channels

### Leaderboard Updates

```typescript
const channel = supabase
  .channel(`pencas:${pencaId}:leaderboard`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'scores',
      filter: `penca_id=eq.${pencaId}`
    },
    (payload) => {
      console.log('Score updated:', payload)
    }
  )
  .subscribe()
```

### Race Status Changes

```typescript
const channel = supabase
  .channel(`pencas:${pencaId}:races`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'races',
      filter: `penca_id=eq.${pencaId}`
    },
    (payload) => {
      console.log('Race updated:', payload)
    }
  )
  .subscribe()
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User doesn't have required permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server-side error |

---

## Rate Limits

- **Edge Functions**: 100 requests per minute per user
- **Realtime**: 100 concurrent connections per project
- **Storage**: 50 MB upload limit per file

---

## Testing with cURL

### Create Penca
```bash
curl -X POST http://localhost:54321/functions/v1/create-penca \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Penca",
    "slug": "test-penca",
    "initial_ruleset": {
      "points_top3": {"first": 5, "second": 3, "third": 1},
      "modalities_enabled": ["winner"],
      "tiebreakers_order": [],
      "lock_minutes_before_start": 15,
      "sealed_predictions_until_close": true
    }
  }'
```

### Join with Code
```bash
curl -X POST http://localhost:54321/functions/v1/join-with-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "TESTCODE123"}'
```
