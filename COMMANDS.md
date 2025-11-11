# Comandos Útiles - Pencas Hípicas

## 📦 Instalación y Setup

```bash
# Instalar dependencias
npm install

# Instalar Supabase CLI globalmente
npm install -g supabase

# Iniciar Supabase local (requiere Docker)
npm run supabase:start

# Detener Supabase local
npm run supabase:stop

# Resetear base de datos (re-aplica todas las migraciones y seed)
npm run supabase:reset
```

## 🔧 Desarrollo

```bash
# Iniciar servidor de desarrollo Next.js
npm run dev

# Build para producción
npm run build

# Iniciar servidor de producción
npm start

# Lint
npm run lint

# Type-check (sin emitir archivos)
npm run type-check
```

## 🗄️ Base de Datos

```bash
# Generar tipos TypeScript desde el schema
npm run supabase:gen-types

# Crear nueva migración
supabase migration new nombre_de_migracion

# Aplicar migraciones pendientes
npm run supabase:migrate

# Ver diferencias con schema local
supabase db diff

# Dump de la base de datos
supabase db dump -f backup.sql

# Ejecutar seed manualmente
supabase db seed
```

## ⚡ Edge Functions

```bash
# Listar funciones
supabase functions list

# Deploy una función específica
supabase functions deploy create-penca

# Deploy todas las funciones
supabase functions deploy create-penca && \
supabase functions deploy add-race-batch && \
supabase functions deploy close-predictions && \
supabase functions deploy publish-result && \
supabase functions deploy recalculate-scores && \
supabase functions deploy join-with-code

# Ver logs de una función
supabase functions logs create-penca

# Servir función localmente para debugging
supabase functions serve create-penca --debug

# Ejecutar función local con curl
curl -X POST http://localhost:54321/functions/v1/create-penca \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

## 🔐 Autenticación y Usuarios

```bash
# Ver usuarios (en Supabase Studio)
# http://localhost:54323 > Authentication > Users

# O via SQL:
supabase db execute --sql "SELECT * FROM auth.users;"

# Crear usuario admin via SQL
supabase db execute --file scripts/create-admin.sql
```

## 📊 Consultas Útiles

```bash
# Ver todas las pencas
supabase db execute --sql "SELECT * FROM pencas;"

# Ver leaderboard de una penca
supabase db execute --sql "
  SELECT * FROM penca_leaderboard 
  WHERE penca_id = 'UUID_AQUI' 
  ORDER BY total_points DESC;
"

# Ver próximas carreras
supabase db execute --sql "
  SELECT * FROM upcoming_races 
  WHERE start_at > NOW() 
  ORDER BY start_at ASC;
"

# Ver predicciones de una carrera
supabase db execute --sql "
  SELECT p.*, pr.display_name 
  FROM predictions p 
  JOIN profiles pr ON pr.id = p.user_id 
  WHERE p.race_id = 'UUID_AQUI';
"

# Ver audit log de una penca
supabase db execute --sql "
  SELECT * FROM audit_log 
  WHERE target_table = 'pencas' AND target_id = 'UUID_AQUI' 
  ORDER BY created_at DESC;
"
```

## 🔗 Conectar a Supabase Cloud

```bash
# Linkear proyecto local con proyecto cloud
supabase link --project-ref tu-project-ref

# Ver status del link
supabase status

# Push migraciones a cloud
supabase db push

# Pull schema desde cloud
supabase db pull
```

## 🚀 Deployment

```bash
# Deploy a Vercel (desde CLI)
vercel

# Deploy a producción
vercel --prod

# Ver logs de deployment
vercel logs

# Ver variables de entorno
vercel env ls

# Agregar variable de entorno
vercel env add NEXT_PUBLIC_SUPABASE_URL
```

## 🧪 Testing

```bash
# Ejecutar tests (cuando se implementen)
npm test

# Ver cobertura
npm run test:coverage

# Test de integración
npm run test:integration
```

## 🔍 Debugging

```bash
# Ver logs de Supabase local
supabase logs

# Ver logs de PostgreSQL
supabase logs db

# Ver logs de API
supabase logs api

# Ver logs de Auth
supabase logs auth

# Ver logs de Storage
supabase logs storage

# Ver logs de Realtime
supabase logs realtime
```

## 📱 Supabase Studio

```bash
# Abrir Studio local
open http://localhost:54323

# O en Windows:
start http://localhost:54323

# Secciones útiles:
# - Table Editor: ver/editar datos
# - SQL Editor: ejecutar queries
# - Database: ver schema, triggers, functions
# - Authentication: gestionar usuarios
# - Storage: ver/subir archivos
# - Edge Functions: ver logs, invocaciones
```

## 🔄 Reset y Limpieza

```bash
# Reset completo de base de datos
npm run supabase:reset

# Limpiar archivos generados
rm -rf .next
rm -rf node_modules

# Reinstalar todo
npm install

# Reset de Supabase (elimina todo, incluido Docker volumes)
supabase stop --no-backup
supabase start
npm run supabase:reset
```

## 📦 Git

```bash
# Primer commit
git add .
git commit -m "Initial setup: Supabase + Next.js complete infrastructure"
git push origin main

# Ver cambios en migraciones
git diff supabase/migrations/

# Stash cambios temporalmente
git stash
git stash pop
```

## 🔑 Obtener JWT Token para Testing

### Via JavaScript (Browser Console en http://localhost:3000)

```javascript
// Después de hacer login en tu app:
const { data: { session } } = await supabase.auth.getSession()
console.log(session.access_token)
// Copiar este token para usar en curl
```

### Via Supabase Studio

1. Ve a SQL Editor
2. Ejecuta:
```sql
SELECT auth.sign_in('admin@test.com', 'admin123');
```
3. Copia el JWT del resultado

## 📊 Monitoreo

```bash
# Ver uso de recursos
docker stats

# Ver procesos de Supabase
docker ps

# Ver logs en tiempo real
supabase logs --follow

# Ver métricas de Edge Functions (en cloud)
# Dashboard de Supabase > Edge Functions > [nombre] > Metrics
```

## 🆘 Troubleshooting Rápido

```bash
# Si Supabase no inicia:
docker restart supabase-db
supabase stop
supabase start

# Si hay error de migraciones:
supabase db reset --debug

# Si hay error de tipos:
npm run supabase:gen-types
npm run type-check

# Si Next.js no compila:
rm -rf .next
npm run dev

# Ver todas las conexiones a la DB:
supabase db execute --sql "
  SELECT * FROM pg_stat_activity 
  WHERE datname = 'postgres';
"
```

## 📚 Documentación Rápida

```bash
# Ver help de Supabase CLI
supabase --help
supabase db --help
supabase functions --help

# Ver help de Next.js
npx next --help

# Ver versiones
supabase --version
node --version
npm --version
```

## 🎯 Comandos Específicos del Proyecto

```bash
# Crear penca de prueba (via Edge Function)
curl -X POST http://localhost:54321/functions/v1/create-penca \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Primera Penca",
    "slug": "mi-primera-penca",
    "description": "Testing",
    "initial_ruleset": {
      "points_top3": {"first": 5, "second": 3, "third": 1},
      "modalities_enabled": ["winner", "exacta"],
      "tiebreakers_order": [],
      "lock_minutes_before_start": 15,
      "sealed_predictions_until_close": true
    }
  }'

# Unirse con código
curl -X POST http://localhost:54321/functions/v1/join-with-code \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "TESTCODE123"}'

# Publicar resultado
curl -X POST http://localhost:54321/functions/v1/publish-result \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "race_id": "UUID_RACE",
    "official_order": ["UUID_ENTRY1", "UUID_ENTRY2", "UUID_ENTRY3"]
  }'
```

## 🔧 Aliases Útiles (Agregar a .bashrc o .zshrc)

```bash
# Agregar estos aliases para agilizar:
alias supa-start="npm run supabase:start"
alias supa-stop="npm run supabase:stop"
alias supa-reset="npm run supabase:reset"
alias supa-types="npm run supabase:gen-types"
alias supa-studio="open http://localhost:54323"
alias dev="npm run dev"
alias pencas-status="supabase status"
```

---

## 🎓 Pro Tips

1. **Usa `.env.local` para desarrollo** - nunca commitees este archivo
2. **Regenera tipos después de cambiar schema** - `npm run supabase:gen-types`
3. **Usa Supabase Studio para debugging** - más rápido que SQL manual
4. **Backupea antes de migrations grandes** - `supabase db dump`
5. **Testea Edge Functions localmente primero** - antes de deploy
6. **Usa `--debug` en comandos problemáticos** - muestra más info
7. **Mantén seed.sql actualizado** - facilita testing
8. **Revisa audit_log frecuentemente** - detecta problemas temprano

---

**Nota**: Reemplaza `$TOKEN` con tu JWT real en comandos curl.
