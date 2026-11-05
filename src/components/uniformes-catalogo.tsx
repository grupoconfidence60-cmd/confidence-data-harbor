import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page";
import { UniformeTamanhos } from "@/components/uniforme-tamanhos";
import { tipoUniforme } from "@/components/material-tipos";
import { ehUniforme, normalizarUniforme } from "@/lib/uniformes";

type Item = { id: string; nome: string; categoria: string; tamanho: string; identificacao?: string };

export function UniformesCatalogo({ items, canManage }: { items: Item[]; canManage: boolean }) {
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
  ];

  return <div className="space-y-6 text-foreground">
    <p className="text-sm text-muted-foreground">Uniformes cadastrados, disponíveis para qualquer função. Os tamanhos abaixo vêm do catálogo; novos tamanhos não alteram o estoque dos anteriores.</p>
    {secoes.map((secao) => <section key={secao.titulo} className="space-y-3" aria-label={secao.titulo}>
      <h2 className="text-lg font-semibold">{secao.titulo}</h2>
      {!secao.items.length ? <EmptyState text="Nenhum uniforme encontrado nesta área com a busca atual." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {secao.items.map((grupo) => {
          const item = grupo[0];
          const tamanhos = [...new Map(grupo.map((i) => [normalizarUniforme(i.tamanho), i.tamanho.trim()])).values()]
            .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
          return <article key={normalizarUniforme(item.nome)} className="min-w-0 space-y-3 rounded-lg border bg-card p-4 text-card-foreground">
            <h3 className="break-words font-semibold">{item.nome}</h3>
            <div className="flex flex-wrap gap-2" aria-label={`Tamanhos cadastrados de ${item.nome}`}>
              {tamanhos.map((tamanho) => <Badge key={normalizarUniforme(tamanho)} variant="secondary">{tamanho || "Sem tamanho informado"}</Badge>)}
            </div>
            {canManage && <UniformeTamanhos item={item} label="Adicionar tamanhos" />}
          </article>;
        })}
      </div>}
    </section>)}
  </div>;
}
