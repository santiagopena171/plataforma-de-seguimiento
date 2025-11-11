# Plataforma de Pencas Hípicas

Sistema de pencas de carreras de caballos entre amigos. **Sin dinero, solo juego social.**

## Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions, Realtime, Storage)

## Características

- ✅ Solo admins pueden crear pencas
- ✅ Versionado de reglas por penca
- ✅ Lock automático de predicciones
- ✅ Sellado de predicciones hasta cierre (opcional)
- ✅ Cálculo automático de puntos
- ✅ Leaderboard en tiempo real
- ✅ Sistema de invitaciones por código
- ✅ Auditoría completa de cambios

## Setup Local

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Instalar Supabase CLI**
   ```bash
   npm install -g supabase
   ```

3. **Iniciar Supabase local**
   ```bash
   npm run supabase:start
   ```

4. **Configurar variables de entorno**
   Copiar `.env.example` a `.env.local` y completar con las credenciales locales de Supabase.

5. **Ejecutar migraciones**
   ```bash
   npm run supabase:reset
   ```

6. **Generar tipos TypeScript**
   ```bash
   npm run supabase:gen-types
   ```

7. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

## Estructura del Proyecto

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Rutas de autenticación
│   │   ├── (dashboard)/       # Rutas protegidas
│   │   ├── pencas/            # Gestión de pencas
│   │   └── api/               # API Routes
│   ├── components/             # Componentes React
│   ├── lib/                    # Utilidades y configuración
│   │   └── supabase/          # Cliente Supabase
│   └── types/                  # Tipos TypeScript
├── supabase/
│   ├── config.toml            # Configuración Supabase
│   ├── migrations/            # Migraciones SQL
│   ├── functions/             # Edge Functions
│   └── seed.sql               # Datos de prueba
└── public/                     # Assets estáticos
```

## Roles de Usuario

- **admin**: Puede crear pencas, gestionar reglas, carreras y resultados
- **user**: Puede unirse a pencas y hacer pronósticos

## Disclaimer Legal

Esta plataforma es exclusivamente para juego social entre amigos. **No gestiona apuestas ni dinero real.**

## Licencia

Privado - Todos los derechos reservados
