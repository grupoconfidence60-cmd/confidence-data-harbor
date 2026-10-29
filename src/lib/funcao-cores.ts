export type FuncaoTom =
  | "vigia"
  | "intermitente"
  | "vigilante"
  | "bombeiro"
  | "administrativo"
  | "supervisor"
  | "outra";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Vigia cinza · Intermitente (vigia ou bombeiro) laranja · Vigilante azul · Bombeiro vermelho · Assistente Administrativo preto · Supervisor cinza escuro. */
export function funcaoTom(nome: string | null | undefined): FuncaoTom {
  const n = norm(nome ?? "");
  if (/\bassistente\s+administrativo\b/.test(n)) return "administrativo";
  if (n.includes("supervisor")) return "supervisor";
  if (n.includes("intermitente")) return "intermitente";
  if (n.includes("bombeiro")) return "bombeiro";
  if (n.includes("vigilante")) return "vigilante";
  if (n.includes("vigia")) return "vigia";
  return "outra";
}

export const FUNCAO_CLASSES: Record<FuncaoTom, string> = {
  vigia: "bg-funcao-vigia text-primary-foreground",
  intermitente: "bg-funcao-intermitente text-primary-foreground",
  vigilante: "bg-funcao-vigilante text-primary-foreground",
  bombeiro: "bg-funcao-bombeiro text-primary-foreground",
  administrativo: "bg-black text-white",
  supervisor: "bg-neutral-700 text-white",
  outra: "bg-muted text-muted-foreground",
};
export const FUNCAO_BORDA: Record<FuncaoTom, string> = {
  vigia: "border-l-4 border-l-funcao-vigia",
  intermitente: "border-l-4 border-l-funcao-intermitente",
  vigilante: "border-l-4 border-l-funcao-vigilante",
  bombeiro: "border-l-4 border-l-funcao-bombeiro",
  administrativo: "border-l-4 border-l-black",
  supervisor: "border-l-4 border-l-neutral-700",
  outra: "",
};
