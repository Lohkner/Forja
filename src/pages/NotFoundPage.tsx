import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <h1 className="display text-5xl">Aquí no hay nada</h1>
      <p className="mt-4 text-ink-2">Puede que el mazo se guardara en otro navegador.</p>
      <Link to="/" className="btn-cta mt-8">Volver al inicio</Link>
    </div>
  );
}
