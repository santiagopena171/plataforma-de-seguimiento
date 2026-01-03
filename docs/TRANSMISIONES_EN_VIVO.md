# Transmisiones en Vivo de YouTube en la Penca

## 📺 Funcionalidad Nueva

Ahora puedes agregar transmisiones en vivo de YouTube a la página pública de tu penca. Los visitantes podrán ver las transmisiones directamente sin necesidad de iniciar sesión.

## ✅ Ventajas

- **No sobrecarga tu infraestructura**: Los videos se transmiten directamente desde YouTube al navegador del usuario, sin pasar por Vercel ni Supabase
- **Costo cero**: No consume tus límites de Vercel ni Supabase
- **Fácil de gestionar**: Interfaz administrativa simple para agregar/editar/eliminar transmisiones

## 🚀 Instalación

### Paso 1: Aplicar la migración a Supabase

Ve a tu proyecto de Supabase → SQL Editor y ejecuta el contenido del archivo:
```
supabase/migrations/20260102_add_live_streams.sql
```

Esto creará:
- Tabla `live_streams` para almacenar las configuraciones
- Políticas RLS para que cualquiera pueda ver los streams activos
- Políticas para que solo admins puedan gestionar streams

### Paso 2: Verificar que todo esté funcionando

1. Inicia tu servidor de desarrollo: `npm run dev`
2. Ve a la página de administración de una penca
3. Verás un nuevo tab "🔴 Transmisiones"

## 📖 Cómo Usar

### Para Administradores

1. **Acceder a la gestión de transmisiones**:
   - Ve a `/admin/penca/[tu-slug]`
   - Haz clic en el tab "🔴 Transmisiones"

2. **Agregar una nueva transmisión**:
   - Haz clic en "+ Nueva Transmisión"
   - Completa el formulario:
     - **Título**: Nombre que se mostrará (ej: "Carreras en Vivo - Maroñas")
     - **Descripción** (opcional): Información adicional
     - **URL de YouTube**: Pega la URL completa del video o transmisión
   
3. **Obtener la URL de YouTube**:
   - Ve a YouTube y abre el video o transmisión que quieres mostrar
   - Copia la URL completa de la barra de direcciones
   - Ejemplo: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Pégala directamente en el campo - ¡el sistema detecta automáticamente el tipo!

4. **Gestionar transmisiones existentes**:
   - **Activar/Desactivar**: Controla qué transmisiones se muestran en la página pública
   - **Editar**: Modifica título, descripción o URL
   - **Eliminar**: Borra una transmisión permanentemente
   - **Orden**: Define en qué orden aparecen (número menor = más arriba)
   - **Ver en YouTube**: Haz clic en la URL para abrir la transmisión en YouTube

### Para Visitantes Públicos

1. **Ver las transmisiones**:
   - Accede a `/public/[slug-de-la-penca]`
   - Si hay transmisiones activas, aparecerán en la parte superior de la página
   - Se pueden ver en pantalla completa haciendo clic en el botón de YouTube

## 🎯 Casos de Uso

### 1. Transmisión en vivo de carreras
```
Título: Carreras del Día - Hipódromo de Maroñas
Descripción: Transmisión en directo de todas las carreras del domingo
URL: https://www.youtube.com/channel/UCxxxxxxxx/live
```

### 2. Video específico de una carrera
```
Título: Final del Gran Premio
Descripción: Repetición de la carrera más importante del año
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### 3. Video en formato corto (youtu.be)
```
Título: Resumen de la Jornada
URL: https://youtu.be/dQw4w9WgXcQ
```

### 4. Múltiples streams
Puedes agregar varias transmisiones (ej: diferentes hipódromos) y los visitantes verán todos los embeds en una grilla de 2 columnas. Simplemente pega cada URL y asigna un orden diferente.

## 🎯 URLs Soportadas

El sistema detecta automáticamente el tipo de contenido desde estas URLs:

- `https://www.youtube.com/watch?v=VIDEO_ID` - Video normal
- `https://youtu.be/VIDEO_ID` - URL corta de video
- `https://www.youtube.com/embed/VIDEO_ID` - URL embed
- `https://www.youtube.com/channel/CHANNEL_ID/live` - Canal en vivo
- `VIDEO_ID` - Si pegas solo el ID (11 caracteres)

## 🔧 Archivos Creados/Modificados

### Nuevos Archivos:
- `src/components/YouTubeLiveEmbed.tsx` - Componente para embeder videos
- `src/components/LiveStreamsManager.tsx` - Interfaz de administración
- `supabase/migrations/20260102_add_live_streams.sql` - Tabla y políticas

### Archivos Modificados:
- `src/app/public/[slug]/page.tsx` - Muestra los streams en la página pública
- `src/app/admin/penca/[slug]/PencaTabs.tsx` - Agrega tab de transmisiones
- `src/app/admin/penca/[slug]/page.tsx` - Pasa el ID de la penca

## 📊 Límites y Consideraciones

### ✅ No hay límites de:
- Ancho de banda (YouTube lo maneja)
- Tiempo de visualización
- Número de espectadores simultáneos

### ⚠️ Consideraciones:
- Los videos deben ser públicos en YouTube
- Si el video se elimina de YouTube, dejará de funcionar
- YouTube puede bloquear embeds en algunos casos (verifica la configuración del video)

## 🐛 Solución de Problemas

### "El video no se muestra"
1. Verifica que el video sea público en YouTube
2. Verifica que el ID sea correcto
3. Algunos videos tienen restricciones de embed - verifica en YouTube

### "No puedo agregar transmisiones"
1. Verifica que eres admin de la penca
2. Verifica que la migración se aplicó correctamente
3. Revisa la consola del navegador para errores

### "Los visitantes no ven las transmisiones"
1. Verifica que la transmisión esté marcada como "Activa"
2. Actualiza la página con Ctrl+F5
3. Verifica que el campo `is_active` esté en `true` en la tabla

## 🎨 Personalización

Si quieres cambiar el diseño de los embeds, edita:
- `src/components/YouTubeLiveEmbed.tsx` - Estilo del embed individual
- `src/app/public/[slug]/page.tsx` - Layout de la sección de streams

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs de la consola del navegador (F12)
2. Verifica que la migración se aplicó correctamente en Supabase
3. Asegúrate de que el video de YouTube sea público y permita embeds
