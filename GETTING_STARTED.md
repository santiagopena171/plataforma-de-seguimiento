# 🏇 Pencas Hípicas - Guía de Inicio Rápido

¡Bienvenido! Esta guía te ayudará a poner en marcha el proyecto en minutos.

## 📋 Requisitos Previos

- Node.js 18 o superior
- Git
- Cuenta en Supabase (gratuita)

## 🚀 Instalación Local

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Supabase Local

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local (Docker requerido)
npm run supabase:start
```

Esto iniciará:
- PostgreSQL en puerto 54322
- API en puerto 54321
- Studio en http://localhost:54323

### 3. Configurar Variables de Entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Luego edita `.env.local` con los valores que aparecen al ejecutar `supabase start`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[copiado de supabase start]
SUPABASE_SERVICE_ROLE_KEY=[copiado de supabase start]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Aplicar Migraciones

```bash
npm run supabase:reset
```

Esto crea todas las tablas, vistas, funciones y datos de prueba.

### 5. Generar Tipos TypeScript

```bash
npm run supabase:gen-types
```

### 6. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## 🎯 Datos de Prueba

El seed incluye:

**Usuarios**:
- 1 admin: `00000000-0000-0000-0000-000000000001`
- 5 users: IDs del `000002` al `000006`

**Penca**: "Penca de Prueba"
- ID: `11111111-1111-1111-1111-111111111111`
- Código de invitación: `TESTCODE123`
- 3 carreras programadas

**Nota**: Para login, necesitas crear usuarios en Supabase Studio (http://localhost:54323) > Authentication > Users.

## 🔑 Crear Usuario Admin para Testing

### Opción A: Via Supabase Studio

1. Ve a http://localhost:54323
2. Navega a Authentication > Users
3. Click "Add User"
4. Llena:
   - Email: `admin@test.com`
   - Password: `admin123` (o tu preferencia)
   - Auto Confirm User: ✅
5. Click "Create User"

### Opción B: Via SQL

En Supabase Studio > SQL Editor, ejecuta:

```sql
-- Crear usuario auth (reemplaza con tu email/password)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- El perfil se crea automáticamente por el trigger
-- Verificar:
SELECT * FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';
```

## 📚 Estructura del Proyecto

```
plataforma-de-seguimiento/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # Landing (simple launcher: buscar penca por slug)
│   │   └── layout.tsx    # Root layout
│   ├── components/        # Componentes React (a implementar)
│   ├── lib/
│   │   └── supabase/     # Cliente Supabase
│   └── types/            # Tipos TypeScript
├── supabase/
│   ├── config.toml       # Configuración Supabase
│   ├── migrations/       # Migraciones SQL
│   │   ├── 20240101000000_initial_schema.sql
│   │   ├── 20240101000001_rls_policies.sql
│   │   └── 20240101000002_realtime_storage.sql
│   ├── functions/        # Edge Functions
│   │   ├── create-penca/
│   │   ├── add-race-batch/
│   │   ├── close-predictions/
│   │   ├── publish-result/
│   │   ├── recalculate-scores/
│   │   └── join-with-code/
│   └── seed.sql          # Datos de prueba
├── docs/                 # Documentación
│   ├── API.md           # Documentación de API
│   ├── DEPLOYMENT.md    # Guía de deployment
│   └── SCHEMA.md        # Documentación del schema
└── package.json
```

## 🧪 Testing de API

### Ver Studio de Supabase

http://localhost:54323

Aquí puedes:
- Ver tablas y datos
- Ejecutar queries SQL
- Ver logs de Edge Functions
- Gestionar usuarios
- Ver Storage

### Test Edge Functions con cURL

```bash
# Obtener JWT token primero (login via UI o Supabase Studio)
TOKEN="tu-jwt-token"

# Test: Join with Code
curl -X POST http://localhost:54321/functions/v1/join-with-code \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "TESTCODE123"}'
```

## 📖 Próximos Pasos

### Fase 1: Autenticación (Completar)
- [ ] Páginas de Login/Signup
- [ ] Layout protegido con auth
- [ ] Navbar con usuario logueado

### Fase 2: Dashboard
- [ ] Vista "Mis Pencas"
- [ ] Vista "Próximas Carreras"
- [ ] Notificaciones

### Fase 3: Gestión de Pencas (Admin)
- [ ] Form crear penca
- [ ] Gestión de reglas
- [ ] CRUD de carreras
- [ ] Publicar resultados
- [ ] Panel de invitaciones

### Fase 4: Jugador
- [ ] Ver detalle de penca
- [ ] Hacer pronósticos
- [ ] Ver leaderboard
- [ ] Historial de carreras

### Fase 5: Tiempo Real
- [ ] Leaderboard live
- [ ] Notificaciones de cierre
- [ ] Updates de carreras

## 🆘 Problemas Comunes

### "Cannot connect to Supabase"

Asegúrate que Docker está corriendo y ejecuta:
```bash
supabase stop
supabase start
```

### "RLS policy violation"

Las políticas RLS son estrictas. Verifica:
- El usuario está autenticado
- Tiene el rol correcto (admin/user)
- Es miembro de la penca

### "Edge Function error"

Revisa logs en Supabase Studio > Edge Functions o:
```bash
supabase functions serve create-penca --debug
```

### Errores de TypeScript

Los errores en archivos `.ts` de Edge Functions son esperados en VSCode (Deno runtime).
Los errores en archivos de Next.js desaparecerán al ejecutar `npm install`.

## 📞 Recursos

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **API Reference**: Ver `docs/API.md`
- **Schema Reference**: Ver `docs/SCHEMA.md`
- **Deployment**: Ver `docs/DEPLOYMENT.md`

## 🎉 ¡Listo!

Ya tienes todo configurado. Próximos pasos:

1. Crear usuario admin en Supabase Studio
2. Login en la app
3. Crear tu primera penca
4. Invitar amigos con el código
5. ¡A pronosticar!

---

**Recordatorio**: Este es un juego social SIN DINERO. Solo diversión entre amigos. 🏇✨
