export type FuncaoTom = "vigia" | "intermitente" | "vigilante" | "bombeiro" | "outra";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Vigia cinza · Intermitente (vigia ou bombeiro) laranja · Vigilante azul · Bombeiro vermelho. */
export function funcaoTom(nome: string | null | undefined): FuncaoTom {
  const n = norm(nome ?? "");
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
  outra: "bg-muted text-muted-foreground",
};
export const FUNCAO_BORDA: Record<FuncaoTom, string> = {
  vigia: "border-l-4 border-l-funcao-vigia",
  intermitente: "border-l-4 border-l-funcao-intermitente",
  vigilante: "border-l-4 border-l-funcao-vigilante",
  bombeiro: "border-l-4 border-l-funcao-bombeiro",
  outra: "",
};
