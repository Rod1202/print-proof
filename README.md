# ProyectoForm

## Estructura de Carpetas Propuesta

```
ProyectoForm/
│
├── index.html
├── logo.png
├── /assets/
│   ├── /css/
│   │   └── estilos.css
│   ├── /img/
│   │   └── (imágenes adicionales)
│   └── /js/
│       └── main.js
├── /modules/
│   ├── supabaseClient.js
│   ├── auth.js
│   ├── printerForm.js
│   ├── fileUpload.js
│   └── search.js
└── README.md
```

- `/assets/`: Recursos estáticos (CSS, imágenes, JS global).
- `/modules/`: Módulos JavaScript con responsabilidades claras.

## Descripción de los módulos
- `supabaseClient.js`: Inicialización y configuración de Supabase.
- `auth.js`: Lógica de autenticación.
- `printerForm.js`: Lógica del formulario de impresoras.
- `fileUpload.js`: Lógica de subida y gestión de archivos.
- `search.js`: Lógica de búsqueda y visualización de resultados. 