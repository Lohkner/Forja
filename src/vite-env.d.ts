/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" en la versión estática (GitHub Pages): no hay servidor propio ni /api. */
  readonly VITE_STATIC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
