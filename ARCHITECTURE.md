# 🏇 Pencas Hípicas - Arquitectura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PENCAS HÍPICAS - STACK                          │
│                      (Juego Social Sin Dinero)                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js 14 (App Router) + TypeScript + Tailwind CSS                   │
│                                                                          │
│  📄 Landing Page (✅)                                                    │
│     - Hero + Features + How It Works + Disclaimer                       │
│                                                                          │
│  🔐 Auth Pages (⏳ Por implementar)                                      │
│     - Login / Signup / Reset Password                                   │
│                                                                          │
│  📊 Dashboard (⏳ Por implementar)                                       │
│     - Mis Pencas / Próximas Carreras / Notificaciones                  │
│                                                                          │
│  ⚙️  Admin Panel (⏳ Por implementar)                                    │
│     - Crear Penca / Gestionar Carreras / Publicar Resultados           │
│                                                                          │
│  🎯 Player Experience (⏳ Por implementar)                               │
│     - Ver Penca / Hacer Pronósticos / Leaderboard                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (Backend)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔒 Auth (Supabase Auth)                                                │
│     ├─ Email + Password                                                 │
│     ├─ OAuth (Google, Apple) - opcional                                 │
│     └─ JWT Tokens                                                       │
│                                                                          │
│  🗄️  PostgreSQL Database (+ RLS)                                        │
│     ├─ 12 Tablas: profiles, pencas, races, predictions, scores...      │
│     ├─ 2 Vistas: penca_leaderboard, upcoming_races                     │
│     ├─ 3 Funciones: is_penca_admin, is_penca_member, is_locked...     │
│     └─ ~40 RLS Policies (seguridad a nivel de fila)                   │
│                                                                          │
│  ⚡ Edge Functions (Serverless)                                          │
│     ├─ create-penca         → Crear nueva penca                        │
│     ├─ add-race-batch       → Agregar carreras masivamente             │
│     ├─ close-predictions    → Cerrar y lockear pronósticos             │
│     ├─ publish-result       → Publicar resultado + calcular puntos     │
│     ├─ recalculate-scores   → Recalcular puntos (correcciones)         │
│     └─ join-with-code       → Unirse a penca con código                │
│                                                                          │
│  📡 Realtime                                                             │
│     ├─ Leaderboard updates (tabla scores)                              │
│     ├─ Race status changes (tabla races)                               │
│     └─ Predictions (si no sellado)                                     │
│                                                                          │
│  💾 Storage (Buckets)                                                    │
│     ├─ avatars/ (5MB max)                                              │
│     └─ pencas-assets/ (10MB max)                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE DATOS PRINCIPAL                          │
└─────────────────────────────────────────────────────────────────────────┘

1️⃣  CREAR PENCA (Admin)
   User → Edge Function: create-penca
       → Inserta: pencas + rulesets v1 + penca_admins
       → Retorna: penca_id + invite code

2️⃣  UNIRSE A PENCA (Player)
   User → Edge Function: join-with-code
       → Valida: invite code (expiración, límites)
       → Inserta: memberships
       → Retorna: penca details

3️⃣  AGREGAR CARRERAS (Admin)
   Admin → Edge Function: add-race-batch
        → Inserta: races + race_entries
        → Retorna: race_ids

4️⃣  HACER PRONÓSTICO (Player)
   Player → DB: INSERT INTO predictions
         → RLS verifica: es miembro, no está locked, antes del cierre
         → Guarda: winner_pick, exacta_pick, trifecta_pick

5️⃣  CERRAR PREDICCIONES (Admin)
   Admin → Edge Function: close-predictions
        → UPDATE races SET status='closed'
        → UPDATE predictions SET is_locked=true
        → Audit log

6️⃣  PUBLICAR RESULTADO (Admin)
   Admin → Edge Function: publish-result
        → INSERT race_results (official_order)
        → UPDATE races SET status='result_published'
        → **CALCULA PUNTOS** por cada predicción:
           - winner_pick == official_order[0] → +5 pts
           - exacta_pick == [official[0], official[1]] → +8 pts
           - trifecta_pick == [official[0], official[1], official[2]] → +9 pts
        → INSERT/UPDATE scores
        → Audit log
        → 📡 Realtime broadcast → Leaderboard se actualiza

7️⃣  VER LEADERBOARD (Todos)
   Client → DB: SELECT FROM penca_leaderboard WHERE penca_id = X
        → RLS permite si es miembro
        → Retorna: ranking con puntos acumulados
   Client → Realtime: subscribe('pencas:X:leaderboard')
        → Recibe updates automáticos


┌─────────────────────────────────────────────────────────────────────────┐
│                      MODELO DE DATOS (RELACIONES)                        │
└─────────────────────────────────────────────────────────────────────────┘

auth.users (Supabase Auth)
    │
    │ 1:1
    ▼
profiles {id, display_name, role: admin|user, avatar_url}
    │
    ├─ 1:N ─────► pencas (created_by)
    │
    ├─ M:N ─────► pencas (via penca_admins)
    │
    ├─ M:N ─────► pencas (via memberships)
    │
    ├─ 1:N ─────► predictions
    │
    └─ 1:N ─────► scores

pencas {id, slug, name, status, rules_version_active}
    │
    ├─ 1:N ─────► rulesets {version, points_top3, modalities, lock_minutes...}
    │
    ├─ 1:N ─────► races {seq, venue, start_at, status}
    │                │
    │                ├─ 1:N ─► race_entries {program_number, horse_name, jockey...}
    │                │
    │                ├─ 1:N ─► predictions {user_id, winner_pick, exacta_pick...}
    │                │
    │                ├─ 1:1 ─► race_results {official_order[3], published_by}
    │                │
    │                └─ 1:N ─► scores {user_id, points_total, breakdown}
    │
    ├─ 1:N ─────► invites {code, expires_at, max_uses, uses}
    │
    └─ 1:N ─────► audit_log {actor_id, action, target_table, diff}


┌─────────────────────────────────────────────────────────────────────────┐
│                       SEGURIDAD (RLS POLICIES)                           │
└─────────────────────────────────────────────────────────────────────────┘

🔒 Nivel 1: Authentication
   - JWT token requerido en todas las requests
   - Supabase Auth verifica token

🔒 Nivel 2: Authorization (RLS)
   - Cada tabla tiene políticas de acceso
   - Validación a nivel de PostgreSQL

Ejemplos:

profiles:
   ✅ SELECT: Ver propio perfil + perfiles de compañeros de penca
   ✅ UPDATE: Solo propio perfil (sin cambiar role)

pencas:
   ✅ INSERT: Solo si profile.role = 'admin'
   ✅ SELECT: Solo si es miembro (via is_penca_member)
   ✅ UPDATE/DELETE: Solo admins de la penca

predictions:
   ✅ INSERT: Solo si es miembro + antes del lock + carrera scheduled
   ✅ UPDATE: Solo propia predicción + no locked + antes del lock
   ✅ SELECT:
      - Si sealed=true: antes del cierre, solo ves la tuya
      - Si sealed=false: miembros ven todas
      - Después del cierre: todos los miembros ven todas

scores:
   ✅ SELECT: Solo miembros de la penca
   ❌ INSERT/UPDATE: Solo Edge Functions (service_role)


┌─────────────────────────────────────────────────────────────────────────┐
│                     VERSIONADO DE REGLAS                                 │
└─────────────────────────────────────────────────────────────────────────┘

Problema: ¿Cómo cambiar reglas sin afectar carreras pasadas?

Solución: Tabla rulesets con versioning

rulesets {
   penca_id,
   version: 1, 2, 3...
   points_top3: {first, second, third}
   modalities_enabled: ['winner', 'exacta']
   effective_from_race_seq: 5  ← A partir de qué carrera aplica
   is_active: true/false
}

Flujo:
   1. Penca creada → ruleset v1 (effective_from_race_seq=1, is_active=true)
   2. Admin cambia reglas → ruleset v2 (effective_from_race_seq=10, is_active=false)
   3. Activa v2 → ruleset v1.is_active=false, v2.is_active=true
   4. Cálculo de puntos:
      - Carrera seq=1-9 → usa ruleset v1
      - Carrera seq=10+ → usa ruleset v2

Beneficio: Auditabilidad + consistencia histórica


┌─────────────────────────────────────────────────────────────────────────┐
│                    CÁLCULO DE PUNTOS (Ejemplo)                           │
└─────────────────────────────────────────────────────────────────────────┘

Configuración:
   points_top3: {first: 5, second: 3, third: 1}
   modalities_enabled: ['winner', 'exacta', 'trifecta']

Resultado oficial:
   1ro: Horse A (uuid-A)
   2do: Horse B (uuid-B)
   3ro: Horse C (uuid-C)

Predicción del Usuario 1:
   winner_pick: uuid-A
   exacta_pick: [uuid-A, uuid-B]
   trifecta_pick: [uuid-A, uuid-B, uuid-C]

Puntos calculados:
   ✅ winner_pick = official[0] → +5 pts (acertó 1ro)
   ✅ exacta_pick = [official[0], official[1]] → +8 pts (acertó 1-2 en orden)
   ✅ trifecta_pick = [official[0], official[1], official[2]] → +9 pts (acertó 1-2-3 en orden)

   Total: 22 puntos

   Breakdown guardado en scores.breakdown:
   {
      "winner": 5,
      "exacta": 8,
      "trifecta": 9
   }

Predicción del Usuario 2:
   winner_pick: uuid-B (incorrecto)
   exacta_pick: [uuid-A, uuid-C] (1ro bien, 2do mal)

Puntos calculados:
   ❌ winner_pick ≠ official[0] → 0 pts
   ❌ exacta_pick ≠ [official[0], official[1]] → 0 pts

   Total: 0 puntos


┌─────────────────────────────────────────────────────────────────────────┐
│                       DEPLOYMENT FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

Local Development:
   [Your Machine]
      ├─ Docker (Supabase local: PostgreSQL + Auth + Storage + Functions)
      └─ Next.js dev server (localhost:3000)

Production:
   [GitHub Repo]
      │
      ├─► [Supabase Cloud]
      │     ├─ PostgreSQL (managed)
      │     ├─ Auth
      │     ├─ Storage
      │     ├─ Edge Functions
      │     └─ Realtime
      │
      └─► [Vercel]
            └─ Next.js app (serverless)

Deploy steps:
   1. supabase link --project-ref XXX
   2. supabase db push (aplica migrations)
   3. supabase functions deploy (sube edge functions)
   4. git push origin main
   5. Vercel auto-deploys
   6. Configure env vars en Vercel


┌─────────────────────────────────────────────────────────────────────────┐
│                      ARCHIVOS DEL PROYECTO                               │
└─────────────────────────────────────────────────────────────────────────┘

plataforma-de-seguimiento/
├── 📄 README.md                    ← Overview + Setup básico
├── 📄 GETTING_STARTED.md           ← Guía paso a paso
├── 📄 PROJECT_SUMMARY.md           ← Resumen completo (este archivo)
├── 📄 COMMANDS.md                  ← Comandos útiles
├── 📄 package.json                 ← Dependencias + scripts
├── 📄 tsconfig.json                ← Config TypeScript
├── 📄 next.config.js               ← Config Next.js
├── 📄 tailwind.config.js           ← Config Tailwind
├── 📄 .env.example                 ← Template de variables
├── 📄 .gitignore                   ← Archivos ignorados
│
├── 📁 src/
│   ├── 📁 app/
│   │   ├── 📄 layout.tsx          ← Root layout
│   │   ├── 📄 page.tsx            ← Landing page ✅
│   │   └── 📄 globals.css         ← Estilos globales
│   │
│   ├── 📁 lib/
│   │   └── 📁 supabase/
│   │       ├── 📄 client.ts       ← Cliente para componentes
│   │       └── 📄 server.ts       ← Helpers para Server Components
│   │
│   └── 📁 types/
│       └── 📄 supabase.ts         ← Tipos generados del schema
│
├── 📁 supabase/
│   ├── 📄 config.toml             ← Config Supabase local
│   ├── 📄 seed.sql                ← Datos de prueba
│   │
│   ├── 📁 migrations/
│   │   ├── 📄 20240101000000_initial_schema.sql     ← Tablas, vistas, funciones
│   │   ├── 📄 20240101000001_rls_policies.sql       ← Políticas de seguridad
│   │   └── 📄 20240101000002_realtime_storage.sql   ← Realtime + Storage
│   │
│   └── 📁 functions/              ← Edge Functions
│       ├── 📁 create-penca/
│       ├── 📁 add-race-batch/
│       ├── 📁 close-predictions/
│       ├── 📁 publish-result/
│       ├── 📁 recalculate-scores/
│       └── 📁 join-with-code/
│
└── 📁 docs/
    ├── 📄 API.md                  ← Documentación de API
    ├── 📄 DEPLOYMENT.md           ← Guía de deployment
    └── 📄 SCHEMA.md               ← Documentación del schema


┌─────────────────────────────────────────────────────────────────────────┐
│                         PRÓXIMOS PASOS                                   │
└─────────────────────────────────────────────────────────────────────────┘

✅ Infraestructura completa
⏳ Falta implementar UI

Orden sugerido:

1. Auth UI (1-2 días)
   └─ Login/Signup pages con Supabase Auth UI

2. Protected Layout (1 día)
   └─ Navbar, sidebar, user menu

3. Dashboard (2-3 días)
   └─ Mis Pencas, Próximas Carreras, Quick Stats

4. Admin: Crear Penca (2 días)
   └─ Wizard multi-step con form validation

5. Admin: Gestionar Carreras (2 días)
   └─ CRUD races + entries, bulk upload

6. Admin: Publicar Resultados (1 día)
   └─ Form 1-2-3, ver scores calculados

7. Player: Ver Penca (1 día)
   └─ Tabs: Reglas, Carreras, Leaderboard, Participantes

8. Player: Hacer Pronósticos (2-3 días)
   └─ Form con countdown, validaciones, confirmación

9. Leaderboard Interactivo (2 días)
   └─ Con Realtime, animaciones, filtros

10. Polish (3-4 días)
    └─ Error handling, loading states, mobile, SEO

Total estimado: 3-4 semanas de desarrollo full-time


┌─────────────────────────────────────────────────────────────────────────┐
│                           DISCLAIMER                                     │
└─────────────────────────────────────────────────────────────────────────┘

⚠️  IMPORTANTE: SITIO DE JUEGO SOCIAL

Esta plataforma es EXCLUSIVAMENTE para entretenimiento entre amigos.

❌ NO se procesan apuestas
❌ NO se gestiona dinero real
❌ NO está relacionado con actividades de juego reguladas

✅ Solo pronósticos deportivos
✅ Solo puntajes y rankings
✅ Solo diversión entre amigos

El disclaimer está visible en:
   - Landing page (sección destacada)
   - Footer de todas las páginas
   - README.md
   - Documentación


┌─────────────────────────────────────────────────────────────────────────┐
│                        ¡TODO LISTO! 🎉                                  │
│                                                                          │
│  La infraestructura está 100% completa y funcional.                     │
│  Ahora solo falta construir la interfaz de usuario.                     │
│                                                                          │
│  ¡Manos a la obra! 🏇✨                                                  │
└─────────────────────────────────────────────────────────────────────────┘
