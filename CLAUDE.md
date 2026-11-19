# Forja de Mazos — guía para Claude Code

Analizador y optimizador de mazos de Magic: The Gathering formato **Commander (EDH)**, en español.
Inspirado en el funcionamiento de edhoptimizer.com (ver `docs/ANALISIS-REFERENCIA.md`), con marca, nombre y diseño propios.
Dueño del proyecto: Serge (Colombia). Idioma de la interfaz, comentarios y commits: **español**.

## Comandos

```bash
npm install
cp .env.example .env      # y pon tu ANTHROPIC_API_KEY (solo hace falta para la optimización con IA)
npm run dev               # web en http://localhost:5173 + API en :8787 (Vite hace de proxy de /api)
npm test                  # Vitest (src/**/*.test.ts)
npm run typecheck
npm run build && npm start   # producción: Express sirve dist/ y /api en :8787
```

Despliegue: `render.yaml` (Blueprint de Render, plan gratuito) o `Dockerfile` (Railway, Fly, cualquier hosting con Docker). Health check en `/api/status`. Variables: `ANTHROPIC_API_KEY` (secreta, en el panel del hosting), `ANTHROPIC_MODEL`, `TRUST_PROXY` (saltos de proxy, por defecto 1). La app es instalable (manifest en `public/`).

Antes de dar una tarea por terminada: `npm run typecheck && npm test && npm run build`.

## Arquitectura

```
src/                     React 19 + Vite 8 + Tailwind 4 + React Router 7 (SPA)
  lib/parse.ts           Texto de la lista → entradas {name, qty, isCommander}. Admite Moxfield, Archidekt, MTGO, texto suelto.
  lib/scryfall.ts        Datos de cartas: POST /cards/collection (75 por lote, 100 ms entre lotes), caché 7 días en localStorage.
  lib/roles.ts           Funciones de cada carta (ramp, robo, removal, barrido, tutor…) por regex sobre el texto Oracle + OVERRIDES.
  lib/analyze.ts         Totales, curva, tipos, demanda de color vs. fuentes, copias, identidad de color, chequeos de salud.
  lib/bracket.ts         Estimación del bracket (1-5) con Game Changers (campo game_changer de Scryfall), MLD, turnos extra, tutores.
  lib/storage.ts         Mazos en localStorage con id "local-xxxxxxxxxx" → ruta /mazo/:id.
  lib/api.ts             Cliente de /api (import y optimización en streaming).
  pages/                 HomePage (importar), DeckPage (/mazo/:id, informe completo), NotFoundPage.
  components/            Charts (curva SVG, barras, pips), HealthList, CardList (filtros por función, vista previa), AiPanel.
server/                  Express 5, JavaScript ESM (sin paso de compilación)
  index.mjs              /api/status, /api/import, /api/optimize (Claude, streaming de texto, límite 10/10 min por IP).
  importers.mjs          Archidekt y Moxfield (el navegador no puede llamarlas por CORS).
  prompts.mjs            Prompt de sistema y de optimización.
```

Flujo: Home guarda el mazo en localStorage → `/mazo/:id` parsea → Scryfall → `analyzeDeck` → `healthChecks` + `estimateBracket` → render. La IA solo se llama cuando el usuario pulsa «Optimizar con IA».

## Convenciones

- TypeScript estricto en `src/`; nada de `any`. Lógica pura en `lib/` con tests; los componentes solo pintan.
- Nombres de cartas siempre en inglés (como en Scryfall); textos de interfaz en español.
- Diseño: tokens en `src/index.css` (`@theme`). Oscuro por defecto, claro con `html[data-theme="light"]`. Clases propias como `@utility` (Tailwind 4 no permite `@apply` de clases de `@layer components`).
- Scryfall: respeta sus normas (lotes, pausas, User-Agent en el servidor, mostrar atribución). Las imágenes se enlazan desde cards.scryfall.io, no se copian.
- La API key de Anthropic vive solo en el servidor (`.env`), nunca en el cliente.
- No copiar código, textos, logotipo ni nombre de edhoptimizer.com: es referencia funcional, no plantilla.

## Estado

Hecho (v0.1): importar por texto o enlace, análisis completo, bracket estimado, IA en streaming, mazos locales, tema claro/oscuro, tests de parser/análisis.

Sin probar contra los servicios reales (se escribió en un entorno sin acceso a esas webs):

Probado (2026-11-18): `server/importers.mjs` con Archidekt funciona (comandante por categoría `isPremier`, Maybeboard excluido, cartas de dos caras). Moxfield responde 403 a toda petición de servidor (anti-bots): el importador devuelve un mensaje que pide pegar el export de texto. No saltarse esa protección; solo reactivar si Moxfield ofrece una API oficial.
- `/api/optimize` con una API key real. Modelo por defecto `claude-sonnet-5-5`, configurable con `ANTHROPIC_MODEL`.
- Las llamadas reales a Scryfall (los tests de UI usaron respuestas simuladas).

## Hoja de ruta (por prioridad)

1. Probar los puntos de arriba y corregir lo que falle.
2. Combos: Commander Spellbook (`backend.commanderspellbook.com`, endpoint find-my-combos) a través de `/api`, y mostrar combos completos y a una carta.
3. Mejorar `roles.ts`: más casos y tests con texto Oracle real; permitir que el usuario corrija la función de una carta (y guardarlo).
4. Importadores extra: Deckstats, TappedOut, MTGGoldfish (la referencia los admite).
5. Constructor guiado desde cero: elegir comandante (autocompletado de Scryfall ya existe en `scryfall.ts`), plantilla de cupos y sugerencias por categoría.
6. Guías SEO: páginas por comandante, arquetipo, mejores cartas por color, mejoras de precons (la referencia las tiene; usar prerender o SSR).
7. Cuentas y mazos en servidor (la referencia usa Google Sign-In); migrar los `local-…`.
8. Inglés (/en/), PWA instalable, contador de vidas, analítica con consentimiento (Consent Mode v2, denegado por defecto).
