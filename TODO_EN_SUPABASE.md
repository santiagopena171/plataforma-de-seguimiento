# 🎯 CHECKLIST: Lo que TÚ necesitas hacer en Supabase

## ✅ PASO 1: Crear Proyecto en Supabase Cloud

1. Ve a https://supabase.com
2. Click "Start your project" o "New Project"
3. Regístrate con GitHub o Email
4. Click "New Project"
5. Completa:
   ```
   Name: pencas-hipicas
   Database Password: [Genera uno seguro y GUÁRDALO]
   Region: South America (São Paulo) - o el más cercano
   Plan: Free
   ```
6. Click "Create new project"
7. **ESPERA 2-3 minutos** mientras se crea el proyecto

---

## ✅ PASO 2: Copiar Credenciales

1. En tu proyecto, ve a **Settings** (⚙️ icono en la barra lateral izquierda)
2. Click en **API**
3. Copia estos 3 valores:

```
📋 Project URL:
https://xxxxxxxxxxxxx.supabase.co

📋 anon public (API Key):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...

📋 service_role (Secret key):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...
```

4. Abre el archivo `.env.local` en tu proyecto
5. Reemplaza los valores:

```env
NEXT_PUBLIC_SUPABASE_URL=pega-tu-project-url-aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=pega-tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=pega-tu-service-role-key-aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## ✅ PASO 3: Crear las Tablas (Ejecutar Migraciones)

### Opción Fácil: Ejecutar archivo SQL todo-en-uno

1. En Supabase Dashboard, click en **SQL Editor** (icono </> en barra lateral)
2. Click en "New query"
3. Abre el archivo `supabase/SETUP_COMPLETO.sql` de tu proyecto
4. Copia TODO el contenido
5. Pega en el SQL Editor
6. Click **"RUN"** (botón verde abajo a la derecha)
7. Espera unos segundos
8. Deberías ver "Success. No rows returned"

### Verificar que se crearon las tablas:

1. Click en **Table Editor** (icono de tabla en barra lateral)
2. Deberías ver 12 tablas:
   - audit_log
   - invites
   - memberships
   - penca_admins
   - pencas
   - predictions
   - profiles
   - race_entries
   - race_results
   - races
   - rulesets
   - scores

---

## ✅ PASO 4: Aplicar Políticas RLS (Seguridad)

1. En **SQL Editor**, crea una nueva query
2. Abre el archivo `supabase/migrations/20240101000001_rls_policies.sql`
3. Copia TODO el contenido
4. Pega en el SQL Editor
5. Click **"RUN"**
6. Espera unos segundos
7. Deberías ver "Success"

---

## ✅ PASO 5: Configurar Storage y Realtime

1. En **SQL Editor**, crea una nueva query
2. Abre el archivo `supabase/migrations/20240101000002_realtime_storage.sql`
3. Copia TODO el contenido
4. Pega en el SQL Editor
5. Click **"RUN"**

### Verificar Storage:

1. Click en **Storage** (icono de carpeta en barra lateral)
2. Deberías ver 2 buckets:
   - avatars
   - pencas-assets

### Habilitar Realtime manualmente (importante):

1. Ve a **Database** > **Replication**
2. Busca la tabla **scores** y activa el toggle a ON
3. Busca la tabla **races** y activa el toggle a ON
4. Busca la tabla **predictions** y activa el toggle a ON

---

## ✅ PASO 6: Insertar Datos de Prueba

1. En **SQL Editor**, crea una nueva query
2. Abre el archivo `supabase/seed.sql`
3. Copia TODO el contenido
4. Pega en el SQL Editor
5. Click **"RUN"**

### Verificar datos de prueba:

1. Ve a **Table Editor**
2. Click en la tabla **profiles** - deberías ver 6 usuarios
3. Click en la tabla **pencas** - deberías ver 1 penca ("Penca de Prueba")
4. Click en la tabla **races** - deberías ver 3 carreras

---

## ✅ PASO 7: Crear Usuario Admin Real

**IMPORTANTE**: Los datos de prueba usan IDs ficticios. Necesitas crear un usuario REAL para poder hacer login.

### Método 1: Via Dashboard (Más fácil)

1. Ve a **Authentication** > **Users**
2. Click **"Add user"** (botón verde)
3. Selecciona **"Create new user"**
4. Completa:
   ```
   Email: admin@test.com (o tu email preferido)
   Password: admin123 (o tu password preferido)
   ✅ Auto Confirm User (IMPORTANTE - marca este checkbox)
   ```
5. Click "Create user"
6. **IMPORTANTE**: Ahora necesitas cambiar el role a admin:
   - Ve a **Table Editor** > **profiles**
   - Busca el usuario que acabas de crear (por email)
   - Click en la fila para editarla
   - En la columna **role**, cambia de `user` a `admin`
   - Click "Save"

### Método 2: Via SQL (Alternativa)

Si prefieres, puedes ejecutar este SQL (reemplaza email y password):

```sql
-- Crear usuario auth
-- NOTA: Esta parte es complicada, mejor usa el método 1

-- Después de crear el usuario en Authentication > Users, actualiza el role:
UPDATE profiles 
SET role = 'admin' 
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@test.com'
);
```

---

## ✅ PASO 8: Configurar Authentication

1. Ve a **Authentication** > **Providers**
2. Verifica que **Email** esté habilitado (debería estar ON por defecto)
3. (Opcional) Habilita **Google OAuth** si quieres login con Google

4. Ve a **Authentication** > **URL Configuration**
5. En **Site URL**, pon: `http://localhost:3000`
6. En **Redirect URLs**, agrega:
   ```
   http://localhost:3000/**
   http://localhost:3000/auth/callback
   ```

---

## ✅ PASO 9: Verificación Final

Ejecuta este query en SQL Editor para verificar todo:

```sql
-- Verificar estructura
SELECT 
  'Tablas' as tipo,
  COUNT(*) as cantidad 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
  'Usuarios' as tipo,
  COUNT(*) as cantidad 
FROM profiles

UNION ALL

SELECT 
  'Pencas' as tipo,
  COUNT(*) as cantidad 
FROM pencas

UNION ALL

SELECT 
  'Carreras' as tipo,
  COUNT(*) as cantidad 
FROM races;
```

Deberías ver:
- Tablas: 12
- Usuarios: 6 (5 de prueba + 1 real)
- Pencas: 1
- Carreras: 3

---

## ✅ PASO 10: Iniciar la Aplicación

Ahora sí, desde tu terminal en el proyecto:

```bash
npm run dev
```

Abre http://localhost:3000

**Para probar el login**:
- Email: `admin@test.com` (o el que pusiste)
- Password: `admin123` (o el que pusiste)

---

## 🎉 ¡LISTO!

Si completaste todos estos pasos, tu backend está 100% funcional en Supabase Cloud.

---

## 🆘 Problemas Comunes

### "Error al ejecutar SQL"
- Asegúrate de copiar TODO el contenido del archivo
- Ejecuta los archivos EN ORDEN
- Si hay error, borra todo y vuelve a empezar

### "No puedo hacer login"
- Verifica que el usuario existe en Authentication > Users
- Verifica que marcaste "Auto Confirm User"
- Verifica que el role en Table Editor > profiles es `admin`
- Verifica que el email y password son correctos

### "RLS Policy Error"
- Asegúrate de haber ejecutado el archivo `20240101000001_rls_policies.sql`
- Verifica que el usuario tiene role `admin` en la tabla profiles

### "Realtime no funciona"
- Ve a Database > Replication
- Activa manualmente las tablas: scores, races, predictions

---

## 📝 Resumen de URLs Importantes

- **Dashboard**: https://supabase.com/dashboard/project/[tu-project-ref]
- **SQL Editor**: https://supabase.com/dashboard/project/[tu-project-ref]/sql
- **Table Editor**: https://supabase.com/dashboard/project/[tu-project-ref]/editor
- **Authentication**: https://supabase.com/dashboard/project/[tu-project-ref]/auth/users
- **Storage**: https://supabase.com/dashboard/project/[tu-project-ref]/storage/buckets

---

## ⏱️ Tiempo Estimado

- Crear proyecto: 3 minutos
- Copiar credenciales: 2 minutos
- Ejecutar SQL (3 scripts): 5 minutos
- Configurar Realtime: 2 minutos
- Crear usuario admin: 3 minutos
- Total: **~15 minutos**

---

Una vez completado, avísame y probamos que todo funcione! 🚀
