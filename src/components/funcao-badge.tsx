import { FUNCAO_CLASSES, funcaoTom } from "@/lib/funcao-cores";

export function FuncaoBadge({ nome, className = "" }: { nome: string | null | undefined; className?: string }) {
  if (!nome) return <span className="text-muted-foreground">—</span>;
  return <span className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${FUNCAO_CLASSES[funcaoTom(nome)]} ${className}`} title={nome}>{nome}</span>;
}

export function FuncaoLegenda() {
  const itens = [["vigia", "Vigia"], ["intermitente", "Intermitente"], ["vigilante", "Vigilante"], ["bombeiro", "Bombeiro"], ["administrativo", "Assistente Administrativo"]] as const;
  return <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{itens.map(([t, l]) => <span key={t} className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${FUNCAO_CLASSES[t].split(" ")[0]}`} />{l}</span>)}</div>;
}
