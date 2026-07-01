# Portfolio personal - Luis Quispe Osorio

Sitio web personal construido con Astro para mostrar perfil profesional, especialidades, tecnologías y proyectos desarrollados. La web incluye una portada con hero, sección de sobre mí, listado de proyectos y una página dedicada para ver todo el portafolio.

## Características

- Presentación personal con enlaces a CV, GitHub, LinkedIn y Figma.
- Secciones de perfil, especialidades y tecnologías.
- Catálogo de proyectos alimentado desde contenido Markdown.
- Páginas individuales para cada proyecto en `/projects/[name]`.
- Recursos estáticos organizados en `public/` para imágenes, documentos, videos y fuentes.

## Tecnologías

- Astro 6
- TypeScript
- Astro Content Collections
- Astro Icon
- Marked
- Swiper
- PhotoSwipe

## Estructura del proyecto

```text
/
├── public/
│   ├── documents/
│   ├── fonts/
│   ├── images/
│   └── videos/
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   │   └── projects/
│   ├── css/
│   ├── js/
│   ├── layouts/
│   └── pages/
└── package.json
```

## Contenido

Los proyectos se definen en `src/content/projects/` como archivos Markdown. El esquema de la colección está en `src/content.config.ts` e incluye campos como `title`, `description`, `github`, `demo`, `figma`, `technologies` y `logo`.

## Comandos

Todos los comandos se ejecutan desde la raíz del proyecto:

| Comando | Acción |
| :-- | :-- |
| `npm install` | Instala dependencias |
| `npm run dev` | Inicia el entorno local en `localhost:4321` |
| `npm run build` | Genera la versión de producción en `dist/` |
| `npm run preview` | Previsualiza la compilación localmente |
| `npm run astro ...` | Ejecuta comandos de Astro como `astro check` o `astro add` |

## Desarrollo

1. Instala dependencias con `npm install`.
2. Ejecuta `npm run dev` para trabajar en local.
3. Agrega o edita proyectos en `src/content/projects/`.
4. Coloca imágenes, PDFs o videos en `public/` según corresponda.

## Nota

Si vas a publicar el sitio, revisa las rutas de los recursos en `public/` y los enlaces externos de cada proyecto antes de generar la versión final.
