# Database Schema Documentation

## Overview

The Pencas Hípicas database uses PostgreSQL (via Supabase) with Row Level Security (RLS) enabled on all tables. The schema supports versioned rulesets, sealed predictions, and real-time leaderboards.

---

## Enums

### user_role
- `admin`: Can create pencas
- `user`: Can join pencas and make predictions

### penca_status
- `draft`: Penca created but not open yet
- `open`: Accepting new members
- `in_progress`: Races started
- `closed`: All races finished

### race_status
- `scheduled`: Race not started, predictions open
- `closed`: Predictions locked, race finished
- `result_published`: Official results published

### membership_role
- `player`: Regular member of a penca

---

## Tables

### profiles
User profile information linked to auth.users.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, references auth.users(id) |
| display_name | text | User's display name |
| avatar_url | text | URL to avatar image |
| role | user_role | User's system role (admin/user) |
| created_at | timestamptz | Account creation timestamp |
| updated_at | timestamptz | Last profile update |

**Indexes**: role

**RLS**: Users can view/edit own profile, can view profiles of penca members

---

### pencas
Competition instances created by admins.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| slug | text | Unique URL-friendly identifier |
| name | text | Penca display name |
| description | text | Optional description |
| status | penca_status | Current penca state |
| rules_version_active | integer | Active ruleset version number |
| created_by | uuid | References profiles(id) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Indexes**: slug, status, created_by

**RLS**: Only admins can create; members can view; admins can update/delete

---

### penca_admins
Co-administrators for each penca.

| Column | Type | Description |
|--------|------|-------------|
| penca_id | uuid | References pencas(id) |
| user_id | uuid | References profiles(id) |
| created_at | timestamptz | When added as admin |

**Primary Key**: (penca_id, user_id)

**Indexes**: user_id

**RLS**: Members can view; admins can add/remove

---

### rulesets
Versioned rules for each penca.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| penca_id | uuid | References pencas(id) |
| version | integer | Version number (1, 2, 3...) |
| points_top3 | jsonb | Points for 1st/2nd/3rd: `{"first":5,"second":3,"third":1}` |
| modalities_enabled | jsonb | Array of enabled modes: `["winner","exacta","trifecta"]` |
| tiebreakers_order | jsonb | Tiebreaker sequence: `["time","submission_time"]` |
| lock_minutes_before_start | integer | Minutes before race start to lock predictions |
| sealed_predictions_until_close | boolean | Hide predictions until race closes |
| effective_from_race_seq | integer | Starting race sequence for this version |
| is_active | boolean | Whether this version is active |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Unique**: (penca_id, version)

**Indexes**: penca_id, (penca_id, is_active)

**RLS**: Members can view; admins can create/update (with restrictions)

---

### races
Individual horse races within a penca.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| penca_id | uuid | References pencas(id) |
| seq | integer | Sequence number within penca (1, 2, 3...) |
| venue | text | Race venue name |
| distance_m | integer | Distance in meters |
| track_condition | text | Track condition (Buena, Pesada, etc.) |
| start_at | timestamptz | Scheduled start time |
| status | race_status | Current race state |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Unique**: (penca_id, seq)

**Indexes**: penca_id, status, start_at, (penca_id, seq)

**Constraints**: start_at must be in future at creation

**RLS**: Members can view; admins can create/update/delete

---

### race_entries
Horses/entries participating in each race.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| race_id | uuid | References races(id) |
| program_number | integer | Entry number (1, 2, 3...) |
| horse_name | text | Horse's name |
| jockey | text | Jockey name |
| trainer | text | Trainer name |
| stud | text | Stud/stable name |
| notes | text | Additional notes |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Unique**: (race_id, program_number)

**Indexes**: race_id

**RLS**: Members can view; admins can create/update/delete

---

### memberships
Players who have joined a penca.

| Column | Type | Description |
|--------|------|-------------|
| penca_id | uuid | References pencas(id) |
| user_id | uuid | References profiles(id) |
| role | membership_role | Member role (currently only 'player') |
| joined_at | timestamptz | When user joined |

**Primary Key**: (penca_id, user_id)

**Indexes**: user_id

**RLS**: Members can view; users can join with valid code; admins can remove

---

### invites
Invitation codes to join pencas.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| penca_id | uuid | References pencas(id) |
| code | text | Unique invite code |
| expires_at | timestamptz | Optional expiration time |
| max_uses | integer | Optional maximum usage limit |
| uses | integer | Current usage count |
| created_by | uuid | References profiles(id) |
| created_at | timestamptz | Creation timestamp |

**Unique**: code

**Indexes**: code, penca_id

**RLS**: Members can view; admins can create/update/delete

---

### predictions
User predictions for races.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| race_id | uuid | References races(id) |
| user_id | uuid | References profiles(id) |
| winner_pick | uuid | References race_entries(id) |
| exacta_pick | jsonb | Array of 2 entry IDs: `["uuid1","uuid2"]` |
| trifecta_pick | jsonb | Array of 3 entry IDs: `["uuid1","uuid2","uuid3"]` |
| tiebreaker_value | text | Tiebreaker value (time, etc.) |
| submitted_at | timestamptz | Submission timestamp |
| is_locked | boolean | Whether prediction is locked |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Unique**: (race_id, user_id)

**Indexes**: race_id, user_id

**RLS**: Users can create/update own predictions before lock; visibility depends on sealed setting

---

### race_results
Official race results (top 3).

| Column | Type | Description |
|--------|------|-------------|
| race_id | uuid | Primary key, references races(id) |
| official_order | jsonb | Array of top 3 entry IDs: `["uuid1","uuid2","uuid3"]` |
| notes | text | Additional notes |
| published_at | timestamptz | Publication timestamp |
| published_by | uuid | References profiles(id) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**RLS**: Members can view; admins can insert/update

---

### scores
Calculated points for each user per race.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| penca_id | uuid | References pencas(id) |
| race_id | uuid | References races(id) |
| user_id | uuid | References profiles(id) |
| points_total | integer | Total points earned |
| breakdown | jsonb | Points breakdown: `{"winner":5,"exacta":0,"trifecta":0}` |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

**Unique**: (race_id, user_id)

**Indexes**: penca_id, race_id, user_id, (penca_id, user_id)

**RLS**: Members can view; only Edge Functions can insert/update

---

### audit_log
Audit trail of admin actions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| actor_id | uuid | References profiles(id) |
| action | text | Action type (create_penca, publish_result, etc.) |
| target_table | text | Affected table name |
| target_id | uuid | Affected record ID |
| diff | jsonb | Changes made |
| created_at | timestamptz | Action timestamp |

**Indexes**: actor_id, (target_table, target_id), created_at DESC

**RLS**: Admins can view logs for their pencas; anyone can insert (via triggers)

---

## Views

### penca_leaderboard
Aggregated scores per user per penca.

**Columns**:
- penca_id
- user_id
- display_name
- avatar_url
- total_points
- races_participated
- race_details (jsonb array)

**Usage**:
```sql
SELECT * FROM penca_leaderboard
WHERE penca_id = 'uuid'
ORDER BY total_points DESC;
```

---

### upcoming_races
Scheduled races with metadata.

**Columns**:
- id
- penca_id
- penca_name
- seq
- venue
- distance_m
- track_condition
- start_at
- status
- lock_minutes_before_start
- lock_at (calculated)
- entries_count
- predictions_count

**Usage**:
```sql
SELECT * FROM upcoming_races
WHERE start_at > NOW()
ORDER BY start_at ASC
LIMIT 10;
```

---

## Functions

### is_penca_admin(penca_id_param, user_id_param)
Returns boolean. Checks if user is admin of the penca.

### is_penca_member(penca_id_param, user_id_param)
Returns boolean. Checks if user is member or admin of the penca.

### is_prediction_locked(race_id_param)
Returns boolean. Checks if current time is past lock deadline.

### handle_new_user()
Trigger function. Auto-creates profile when new auth user is created.

### update_updated_at_column()
Trigger function. Auto-updates updated_at column on row update.

---

## Relationships

```
auth.users (1) → (1) profiles
profiles (1) → (*) pencas [created_by]
profiles (*) → (*) memberships → (*) pencas
profiles (*) → (*) penca_admins → (*) pencas
pencas (1) → (*) rulesets
pencas (1) → (*) races
races (1) → (*) race_entries
races (1) → (*) predictions
profiles (1) → (*) predictions
races (1) → (1) race_results
races (1) → (*) scores
pencas (1) → (*) scores
profiles (1) → (*) scores
```

---

## Storage Buckets

### avatars
- **Public**: Yes
- **Structure**: `{user_id}/avatar.jpg`
- **Max Size**: 5MB
- **Allowed Types**: image/*

### pencas-assets
- **Public**: Yes
- **Structure**: `{penca_id}/logo.png`
- **Max Size**: 10MB
- **Allowed Types**: image/*

---

## Realtime Subscriptions

Tables enabled for Realtime:
- `scores`
- `races`
- `predictions`

Channel naming:
- `pencas:{penca_id}:leaderboard`
- `pencas:{penca_id}:races`
- `pencas:{penca_id}:predictions:{race_id}`
