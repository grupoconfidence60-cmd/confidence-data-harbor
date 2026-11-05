import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page";
import { UniformeTamanhos } from "@/components/uniforme-tamanhos";
import { tipoUniforme } from "@/components/material-tipos";
import { ehUniforme, normalizarUniforme } from "@/lib/uniformes";

type Item = { id: string; nome: string; categoria: string; tamanho: string; identificacao?: string };
type Props = { items: Item[]; canManage: boolean; onArchive?: (id: string) => void; busy?: boolean };

export function UniformesCatalogo({ items, canManage, onArchive, busy = false }: Props) {
  const grupos = new Map<string, Item[]>();
  for (const item of items.filter((i) => ehUniforme(i.categoria))) {
    const key = normalizarUniforme(item.nome);
    const grupo = grupos.get(key) ?? [];
    grupo.push(item);
    grupos.set(key, grupo);
  }
  const uniformes = [...grupos.values()].sort((a, b) => a[0].nome.localeCompare(b[0].nome, "pt-BR"));
  const secoes = [
    { titulo: "Calças", items: uniformes.filter((grupo) => tipoUniforme(grupo[0].nome) === "calca") },
    { titulo: "Demais uniformes", items: uniformes.filter((grupo) => tipoUniforme(grupo[0].nome) !== "calca") },
  ].filter((secao) => secao.items.length > 0);

  return <section className="overflow-hidden rounded-lg border bg-card text-card-foreground" aria-label="Uniformes e tamanhos">
    <div className="border-b bg-muted/50 px-4 py-3">
      <h2 className="font-semibold">Uniformes <span className="ml-1 text-sm font-normal text-muted-foreground">({uniformes.length})</span></h2>
      <p className="text-xs text-muted-foreground">Tamanhos cadastrados, disponíveis para qualquer função. Use “Adicionar tamanhos” para incluir novas opções.</p>
    </div>
    {!uniformes.length ? <EmptyState text="Nenhum uniforme encontrado com a busca atual." /> : secoes.map((secao) => <div key={secao.titulo}>
      <h3 className="border-b bg-muted/20 px-4 py-2 text-xs font-semibold text-muted-foreground">{secao.titulo}</h3>
      <div className="divide-y">{secao.items.map((grupo) => {
        const item = grupo[0];
        const tamanhos = [...new Map(grupo.map((i) => [normalizarUniforme(i.tamanho), i.tamanho.trim()])).values()]
          .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
        return <article key={normalizarUniforme(item.nome)} className="space-y-2 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h4 className="break-words text-sm font-semibold sm:w-52 sm:shrink-0">{item.nome}</h4>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={`Tamanhos cadastrados de ${item.nome}`}>
              {tamanhos.map((tamanho) => <Badge key={normalizarUniforme(tamanho)} variant="secondary" className="max-w-full whitespace-normal break-words">{tamanho || "Sem tamanho informado"}</Badge>)}
            </div>
            {canManage && <div className="shrink-0"><UniformeTamanhos item={item} label="Adicionar tamanhos" /></div>}
          </div>
          <details className="rounded-md text-xs">
            <summary className="w-fit cursor-pointer rounded py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{canManage && onArchive ? "Ver identificação e arquivar tamanhos" : "Ver identificação por tamanho"}</summary>
            <div className="mt-2 divide-y rounded-md border bg-background">{[...grupo].sort((a, b) => a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true })).map((registro) => <div key={registro.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1"><p className="break-words font-medium">{registro.tamanho ? `Tamanho ${registro.tamanho}` : "Sem tamanho informado"}</p><p className="break-words text-muted-foreground">Identificação: {registro.identificacao || "Não informada"}</p></div>
              {canManage && onArchive && <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={`Arquivar ${registro.nome}, ${registro.tamanho || "sem tamanho"}`} onClick={() => onArchive(registro.id)}><Archive className="h-3 w-3" />Arquivar</Button>}
            </div>)}</div>
            {canManage && onArchive && <p className="mt-2 text-muted-foreground">Arquivar retira apenas esta variação do catálogo ativo. O histórico de entregas é preservado.</p>}
          </details>
        </article>;
      })}</div>
    </div>)}
  </section>;
}
