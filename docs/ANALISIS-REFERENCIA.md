# Análisis del sitio de referencia: edhoptimizer.com

Fuente: el HTML de `/mazo/local-liknefe56b` que compartió Serge y la portada pública. El HTML es solo la «cáscara»
de una SPA: la lógica está en bundles JS que no se revisaron. Esto es lo que se puede deducir.

## Qué hace

- Construir un mazo de Commander paso a paso, o importar uno desde Moxfield, Archidekt, Deckstats, TappedOut o MTGGoldfish.
- Informe de análisis: base de maná, curva, combos, bracket, «salud del mazo» y optimización de la lista con IA.
- Secciones de contenido (SEO): guías por comandante, arquetipos, mejores cartas por color, perfiles de cartas, mejoras de precons, guías y vídeos.
- Contador de vidas para la mesa (PWA a pantalla completa con wake lock).
- Gratis, en español, con versión en inglés (`/en/deck/…`).

## Cómo está hecho (pistas del HTML)

| Aspecto | Lo que se ve | Decisión en Forja de Mazos |
|---|---|---|
| Framework | Angular (app-root, chunks de esbuild, ngCspMedia) | React 19 + Vite: más simple para un proyecto nuevo |
| Estilos | Tailwind 4 (capas `@layer theme/base/utilities`, colores oklch) + sistema propio «Aura» | Tailwind 4 con tokens propios en `@theme` |
| Tipografía | Mona Sans variable (peso y ancho; titulares a 112-125 %), Silkscreen de acento | Mona Sans, titulares a 112-125 % |
| Tema | Oscuro `#0d0a14`, CTA violeta `#7c3aed`, claro con `data-theme="light"` puesto antes de pintar | Mismo patrón técnico, paleta propia similar |
| Datos de cartas | `preconnect` a `cards.scryfall.io` (imágenes de Scryfall) | API de Scryfall directa desde el navegador |
| Backend | API propia en `api.edhoptimizer.com` | Express en `/api` (import, IA) |
| Mazos sin cuenta | Rutas `/mazo/local-xxxxxxxxxx` (guardados en el navegador) | Igual: `local-` + localStorage |
| Cuentas | Google Identity Services, cargado solo al abrir el modal | Pendiente (hoja de ruta) |
| Rendimiento | Esqueleto de portada en HTML para pintar antes de que arranque la app; gtag cargado tras el primer render | Pendiente: añadir esqueleto si el JS crece |
| SEO | Canonical, hreflang es/en, Open Graph, Twitter Card, `noindex` en páginas de mazo, texto para crawlers sin JS | Meta básica; añadir al hacer las guías |
| Privacidad | GA4 con Consent Mode v2, todo denegado por defecto (RGPD) | Pendiente; si se añade analítica, igual |
| PWA | `manifest.webmanifest`, theme-color | Pendiente |
| Seguridad | CSP con hashes de scripts y `strict-dynamic` | Pendiente para producción |

## Lecciones que dejan sus propios comentarios en el HTML

- Pintar un esqueleto con los mismos colores y medidas que la portada evita el «salto» a otra web mientras carga.
- Cargar SDKs pesados (Google Sign-In, gtag) solo cuando hacen falta: llegaron a ser el 35 % del arranque.
- Fijar el tema claro/oscuro con un script en el `<head>` evita el fogonazo de color.
- Cuidado con escribir etiquetas literales en comentarios si un script del servidor reemplaza bloques del HTML.
