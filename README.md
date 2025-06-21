# Sistema de Gestión de Impresoras (SPA)

Aplicación web para la gestión integral de impresoras, clientes y archivos, desarrollada como Single Page Application (SPA) con JavaScript modular, HTML parcial y Supabase como backend.

## Características principales

- **Autenticación:**
  - Soporte para login anónimo y con Microsoft (OAuth).
  - Políticas de seguridad (RLS) para proteger los datos de cada usuario.

- **Gestión de impresoras:**
  - Registro de nuevas impresoras con todos los campos relevantes (serie, modelo, estado, observaciones, etc.).
  - Edición de estado, cliente y contacto de cada impresora.
  - Historial automático de cambios (trigger en Supabase).
  - Búsqueda inteligente por número de serie.
  - Visualización de detalles completos de cada impresora.

- **Gestión de clientes y ADMs:**
  - Selección de cliente y ADM asociados en el registro y edición.
  - Información de contacto y ubicación agrupada y editable.

- **Gestión de archivos:**
  - Subida de archivos y fotos asociadas a cada impresora.
  - Almacenamiento en Supabase Storage y registro de metadatos.

- **Interfaz moderna y responsive:**
  - Diseño adaptado a escritorio y móvil.
  - Botones de acción principales siempre accesibles y centrados.
  - Navegación fluida entre vistas (SPA).

## Estructura del proyecto

```
ProyectoForm/
├── assets/
│   ├── css/
│   │   └── estilos.css
│   └── js/
│       └── main.js
├── modules/
│   ├── auth.js
│   ├── fileUpload.js
│   ├── printerForm.js
│   ├── search.js
│   └── supabaseClient.js
├── views/
│   ├── auth.html
│   ├── detail.html
│   ├── edit_client.html
│   ├── edit_contact.html
│   ├── edit_status.html
│   ├── register.html
│   ├── results.html
│   └── search.html
├── index.html
├── logo.png
└── README.md
```

## Tecnologías utilizadas

- **Frontend:**
  - HTML5, CSS3 (Bootstrap y estilos propios)
  - JavaScript ES6+ (modular, SPA)

- **Backend:**
  - [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
  - Políticas RLS para seguridad por usuario
  - Triggers y funciones PL/pgSQL para historial

## Instrucciones de despliegue

1. **Clona el repositorio:**
   ```bash
   git clone <url-del-repo>
   cd ProyectoForm
   ```

2. **Configura Supabase:**
   - Crea un proyecto en [Supabase](https://supabase.com/).
   - Crea las tablas y políticas usando el script SQL proporcionado en la documentación del proyecto.
   - Configura los buckets de Storage (ej: `printer-documents`).
   - Obtén las claves públicas y URL de tu proyecto.

3. **Configura el frontend:**
   - Edita `modules/supabaseClient.js` y coloca tus claves y URL de Supabase.

4. **Ejecuta la aplicación:**
   - Puedes abrir `index.html` directamente o servir el proyecto con cualquier servidor estático (ej: `live-server`).

## Consideraciones de seguridad

- **RLS:**
  - Asegúrate de que las políticas de Row Level Security (RLS) estén correctamente configuradas para proteger los datos de cada usuario.
  - Los datos maestros (clientes, modelos) pueden ser visibles para todos los usuarios autenticados, pero solo editables por sus dueños.

- **Storage:**
  - El bucket de archivos debe tener permisos públicos solo para lectura, y control de escritura por usuario.

## Personalización y mantenimiento

- Puedes modificar los campos de las tablas y los formularios según las necesidades de tu organización.
- El sistema está preparado para escalar y añadir nuevas vistas o módulos fácilmente.

## Autor

Desarrollado por Rodrigo Carbonel.

---

¿Dudas o sugerencias? ¡No dudes en abrir un issue o contactar al autor! 