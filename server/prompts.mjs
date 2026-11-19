export const SYSTEM_PROMPT = `Eres un experto constructor de mazos de Magic: The Gathering en formato Commander (EDH).
Respondes siempre en español, en Markdown breve y concreto. Los nombres de cartas van en inglés, tal como aparecen en Scryfall.
Solo sugieres cartas legales en Commander y dentro de la identidad de color del comandante.
Respetas el estilo del mazo y el objetivo del jugador (bracket, presupuesto, etc.).`;

export function buildOptimizePrompt({ commander, colorIdentity, stats, goal, list }) {
  return `Comandante: ${commander || "desconocido"}
Identidad de color: ${colorIdentity || "incolora"}
Estadísticas del análisis: ${stats || "no disponibles"}
Objetivo del jugador: ${goal || "mejorar la consistencia sin cambiar el estilo del mazo"}

Lista (cantidad, nombre y funciones detectadas entre corchetes):
${list}

Entrega exactamente estas secciones:
## Plan de juego
2-3 frases sobre cómo gana este mazo.
## Combos y sinergias clave
Combos de 2-3 cartas presentes en la lista; si no hay, dilo.
## Cortes sugeridos
5-8 cartas de la lista, cada una con su motivo en una línea.
## Añadidos sugeridos
5-8 cartas nuevas, con su motivo y qué corte reemplazan.
## Base de maná
Ajustes concretos (número de tierras, fuentes de color, tierras recomendadas).
## Bracket
Confirma o corrige el bracket estimado en una frase.`;
}
