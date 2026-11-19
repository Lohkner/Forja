import type { Analysis } from "./analyze";

export interface BracketResult {
  bracket: 1 | 2 | 3 | 4 | 5;
  label: string;
  reasons: string[];
}

export const BRACKET_LABEL = { 1: "Exhibición", 2: "Núcleo", 3: "Mejorado", 4: "Optimizado", 5: "cEDH" } as const;

/**
 * Estimación del bracket de Commander a partir de señales objetivas (Game Changers,
 * destrucción masiva de tierras, turnos extra, tutores, maná rápido y curva).
 * El bracket real también depende de la intención del mazo; esto es solo orientativo.
 */
export function estimateBracket(a: Analysis): BracketResult {
  const gc = a.gameChangers.length;
  const { tutor, extraturn, mld, fastmana } = a.roles;
  const reasons: string[] = [];
  let b: BracketResult["bracket"];

  if (mld > 0 || gc > 3) {
    b = 4;
    if (mld) reasons.push(`${mld} carta(s) de destrucción masiva de tierras`);
    if (gc > 3) reasons.push(`${gc} Game Changers (más de 3)`);
  } else if (gc > 0 || extraturn > 2 || tutor > 4) {
    b = 3;
    if (gc) reasons.push(`${gc} Game Changer(s) (máximo 3 en bracket 3)`);
    if (extraturn > 2) reasons.push(`${extraturn} cartas de turno extra`);
    if (tutor > 4) reasons.push(`${tutor} tutores`);
  } else {
    b = 2;
    reasons.push("Sin Game Changers ni destrucción masiva de tierras");
  }

  if (b === 4 && fastmana >= 4 && tutor >= 6 && a.avgCmc < 2.2) {
    b = 5;
    reasons.push("Mucho maná rápido, muchos tutores y curva muy baja: perfil cEDH");
  }
  reasons.push(`Tutores: ${tutor} · Maná rápido: ${fastmana} · Turnos extra: ${extraturn}`);
  return { bracket: b, label: BRACKET_LABEL[b], reasons };
}
