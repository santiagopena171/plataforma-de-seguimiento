# Setup Instructions - Supabase Local

## ⚠️ IMPORTANTE: Requisitos Previos

Para usar Supabase local necesitas tener **Docker Desktop** instalado y corriendo.

### Instalar Docker Desktop (si no lo tienes)

1. Descarga Docker Desktop para Windows desde: https://www.docker.com/products/docker-desktop
2. Instala y reinicia tu computadora
3. Abre Docker Desktop y asegúrate que esté corriendo (icono de ballena en la bandeja del sistema)

## 🚀 Opción 1: Usar Supabase Local (Recomendado para desarrollo)

Si tienes Docker Desktop instalado:

```bash
# Instalar Supabase CLI con scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# O con Chocolatey
choco install supabase

# Iniciar Supabase local
supabase start

# Aplicar migraciones
supabase db reset

# Ver credenciales
supabase status
```

Esto te dará:
- PostgreSQL local en puerto 54322
- API local en http://localhost:54321
- Studio local en http://localhost:54323

## 🌐 Opción 2: Usar Supabase Cloud (Más fácil, recomendado si no tienes Docker)

Esta es la opción más simple y **NO requiere Docker**. Voy a guiarte:

### Paso 1: Crear Cuenta y Proyecto en Supabase

1. Ve a https://supabase.com
2. Click en "Start your project"
3. Sign up con GitHub o Email
4. Click en "New Project"
5. Completa:
   - **Name**: `pencas-hipicas`
   - **Database Password**: Genera uno seguro (guárdalo!)
   - **Region**: Elige el más cercano (por ejemplo: South America)
   - **Plan**: Free (suficiente para desarrollo)
6. Click "Create new project"
7. Espera 2-3 minutos mientras se crea

### Paso 2: Obtener Credenciales

1. En el dashboard, ve a **Settings** (⚙️ en la barra lateral)
2. Click en **API**
3. Copia estos valores:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public: eyJhbGc....... (token largo)
service_role: eyJhbGc....... (token largo, SECRETO)
```

### Paso 3: Configurar Variables de Entorno

Crea el archivo `.env.local` en la raíz del proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Paso 4: Aplicar Migraciones (Crear las Tablas)

**Opción A: Via SQL Editor (Más Fácil)**

1. En Supabase Dashboard, ve a **SQL Editor** (icono </> en barra lateral)
2. Abre el archivo `supabase/migrations/20240101000000_initial_schema.sql`
3. Copia TODO el contenido
4. Pega en el SQL Editor de Supabase
5. Click "RUN" (ejecutar)
6. Repite con `20240101000001_rls_policies.sql`
7. Repite con `20240101000002_realtime_storage.sql`
8. Repite con `supabase/seed.sql`

**Opción B: Via Supabase CLI (requiere instalarlo)**

```bash
# Linkear con tu proyecto cloud
supabase link --project-ref tu-project-ref

# Push migraciones
supabase db push

# Aplicar seed
supabase db seed
```

### Paso 5: Crear Usuario Admin para Testing

1. En Supabase Dashboard, ve a **Authentication** > **Users**
2. Click **"Add user"** > **"Create new user"**
3. Completa:
   - **Email**: `admin@test.com` (o tu email preferido)
   - **Password**: `admin123` (o tu password preferido)
   - **Auto Confirm User**: ✅ (marca este checkbox)
4. Click "Create user"
5. Ve a **Table Editor** > **profiles**
6. Busca el usuario que creaste
7. Edita la columna `role` y cámbiala de `user` a `admin`
8. Guarda

¡Listo! Ya tienes un usuario admin para entrar.

### Paso 6: Desplegar Edge Functions (Opcional por ahora)

Las Edge Functions se pueden desplegar después cuando las necesites:

```bash
supabase functions deploy create-penca
supabase functions deploy add-race-batch
supabase functions deploy close-predictions
supabase functions deploy publish-result
supabase functions deploy recalculate-scores
supabase functions deploy join-with-code
```

### Paso 7: Iniciar Aplicación

```bash
npm run dev
```

Abre http://localhost:3000

## 🎯 Resumen de lo que YO necesito hacer en Supabase:

### Checklist Rápido:

- [ ] **Crear proyecto** en supabase.com
- [ ] **Copiar credenciales** (URL + anon key + service_role key) → `.env.local`
- [ ] **SQL Editor**: Ejecutar las 3 migraciones + seed
- [ ] **Authentication > Users**: Crear usuario admin
- [ ] **Table Editor > profiles**: Cambiar role a `admin`
- [ ] **Authentication > Providers**: Verificar que Email está habilitado
- [ ] **Authentication > URL Configuration**: Agregar `http://localhost:3000` en "Site URL"
- [ ] **Database > Replication**: Habilitar Realtime en tablas `scores`, `races`, `predictions`

## 🔍 Verificar que Todo Funciona

En Supabase Dashboard:

1. **Table Editor**: Deberías ver 12 tablas creadas
2. **Authentication**: Tu usuario admin debería estar visible
3. **Storage**: Deberías ver buckets `avatars` y `pencas-assets`

## 🆘 Problemas Comunes

### "No puedo ejecutar las migraciones"
- Asegúrate de copiar TODO el contenido del archivo SQL
- Ejecuta los archivos EN ORDEN (00000, 00001, 00002, seed)

### "RLS Policy Error"
- Verifica que ejecutaste el archivo `20240101000001_rls_policies.sql`

### "No puedo hacer login"
- Verifica que el usuario existe en Authentication
- Verifica que marcaste "Auto Confirm User"
- Verifica que el role en profiles es `admin`

## ✅ ¡Listo para Empezar!

Una vez completados estos pasos, tu backend está 100% funcional en Supabase Cloud y puedes empezar a desarrollar la UI.
