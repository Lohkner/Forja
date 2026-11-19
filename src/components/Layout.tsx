import { useState } from "react";
import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === "light");

  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("forja-theme", next ? "light" : "dark");
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center gap-3 border-b border-line px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5 text-[17px] font-extrabold" style={{ fontStretch: "112%" }}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
          Forja de Mazos
        </Link>
        <span className="ml-1 hidden text-sm text-ink-3 sm:inline">Analizador de Commander</span>
        <button onClick={toggleTheme} className="btn ml-auto min-h-9 px-3" aria-label="Cambiar tema">
          {light ? "Oscuro" : "Claro"}
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-ink-3 md:px-8">
        Proyecto de fans no oficial. Magic: The Gathering es marca de Wizards of the Coast. Datos e imágenes de cartas de{" "}
        <a className="underline" href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>.
      </footer>
    </div>
  );
}
