# Forja de Mazos

Analizador y optimizador de mazos de Commander (EDH) en español: curva, base de maná, ramp, robo, removal,
bracket estimado y sugerencias de cortes y añadidos con IA (Claude). Datos e imágenes de cartas de [Scryfall](https://scryfall.com).

## Empezar

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env    # en Windows: copy .env.example .env
npm run dev
```

Abre http://localhost:5173. La optimización con IA necesita `ANTHROPIC_API_KEY` en `.env`; el resto funciona sin ella.

## Trabajar con Claude Code

Abre esta carpeta en Claude Code. `CLAUDE.md` explica la arquitectura, las convenciones, lo que falta probar y la hoja de ruta.
Ideas para empezar: «prueba la importación desde Archidekt y corrígela», «añade combos con Commander Spellbook».

## Producción

```bash
npm run build
npm start               # sirve la web y /api en el puerto PORT (8787 por defecto)
```

Proyecto de fans no oficial. Magic: The Gathering es marca de Wizards of the Coast.
