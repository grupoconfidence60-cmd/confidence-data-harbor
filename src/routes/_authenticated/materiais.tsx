import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Package, Plus, RotateCcw, Search, Shirt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { MateriaisDialog } from "@/components/materiais-dialog";
import { materiaisQuery, baixarMateriais } from "@/lib/materiais";
import { canManageMateriais } from "@/lib/labels";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/materiais")({
  head: () => ({ meta: [
    { title: "Equipamentos e uniformes — Grupo Confidence" },
    { name: "description", content: "Entregas e devoluções de equipamentos e uniformes por colaborador e posto Confidence." },
    { property: "og:title", content: "Equipamentos e uniformes — Grupo Confidence" },
    { property: "og:description", content: "Controle de materiais e histórico de entregas da equipe Confidence." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(materiaisQuery),
  component: () => <RequireModule module="materiais"><Materiais /></RequireModule>,
});
function Materiais() {
  const { data } = useSuspenseQuery(materiaisQuery);
  const { data: me } = useMe();
  const manage = canManageMateriais(me?.roles ?? []);
  const qc = useQueryClient();
  const [tab, setTab] = useState("entregas");
  const [search, setSearch] = useState("");
  const [post, setPost] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "item" | "entrega" | "devolucao"; id?: string; minimumDate?: string } | null>(null);
  const active = data.items.filter((i) => !i.arquivado);
  const itemFor = (id: string) => data.items.find((i) => i.id === id);
  const personFor = (id: string) => data.people.find((c) => c.id === id);
  const postFor = (id: string) => data.posts.find((p) => p.id === id)?.nome ?? "Posto indisponível";
  const matches = (text: string) => text.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  const deliveries = data.deliveries.filter((e) => (post === "todos" || e.posto_id === post) && (status === "todos" || (status === "devolvidos") === Boolean(e.data_devolucao)) && matches(`${itemFor(e.material_id)?.nome} ${personFor(e.colaborador_id)?.nome} ${personFor(e.colaborador_id)?.matricula} ${postFor(e.posto_id)}`));
  const items = active.filter((i) => matches(`${i.nome} ${i.tamanho} ${i.identificacao}`));
  const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
  async function archive(id: string) {
    if (busy || !window.confirm("Arquivar este material? As entregas anteriores serão preservadas.")) return;
    setBusy(true);
    const result = await supabase.from("materiais").update({ arquivado: true }).eq("id", id).select("id").single();
    setBusy(false);
    if (result.error) { toast.error("Não foi possível arquivar o material."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Material arquivado.");
  }
  function exportRows() {
    baixarMateriais(deliveries.map((e) => { const i = itemFor(e.material_id); const c = personFor(e.colaborador_id); return [i?.nome ?? "", i?.categoria ?? "", i?.tamanho ?? "", i?.identificacao ?? "", c?.matricula ?? "", c?.nome ?? "Colaborador indisponível", postFor(e.posto_id), e.quantidade, e.data_entrega, e.data_devolucao ?? "", e.condicao_devolucao ?? "", e.observacoes]; }));
  }
  return <div>
    <PageHeader title="Equipamentos e uniformes" description="Materiais · Entregas · Devoluções" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportRows} disabled={!deliveries.length}><Download />Excel</Button>{manage && <Button variant="outline" onClick={() => setDialog({ mode: "item" })}><Plus />Material</Button>}<Button onClick={() => setDialog({ mode: "entrega" })} disabled={!active.length || !data.people.length || !data.posts.length}><Plus />Registrar entrega</Button></div>} />
    <div className="mb-6 grid grid-cols-3 divide-x border-y py-4">{[["Materiais ativos", active.length], ["Em uso · unidades", data.deliveries.filter((e) => !e.data_devolucao).reduce((s, e) => s + e.quantidade, 0)], ["Devoluções", data.deliveries.filter((e) => e.data_devolucao).length]].map(([label, value]) => <div key={label} className="px-3 sm:px-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="mb-4 flex flex-wrap items-center gap-3"><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="entregas">Entregas e histórico</TabsTrigger><TabsTrigger value="catalogo">Materiais</TabsTrigger></TabsList></Tabs><div className="relative w-full sm:ml-auto sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar materiais ou colaboradores" placeholder="Buscar" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
    {tab === "entregas" ? <>
      <div className="mb-4 flex flex-wrap gap-3"><Select value={post} onValueChange={setPost}><SelectTrigger className="w-full sm:w-64" aria-label="Filtrar posto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os postos</SelectItem>{data.posts.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44" aria-label="Filtrar situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="em_uso">Em uso</SelectItem><SelectItem value="devolvidos">Devolvidos</SelectItem></SelectContent></Select></div>
      {!deliveries.length ? <EmptyState text="Nenhuma entrega encontrada." /> : <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[850px]"><thead><tr>{["Material", "Colaborador", "Posto", "Qtd.", "Entrega", "Situação", "Devolução", ""].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{deliveries.map((e) => <tr key={e.id} className="border-t"><td className="px-3 py-3"><p className="font-medium">{itemFor(e.material_id)?.nome}</p><p className="text-xs text-muted-foreground">{itemFor(e.material_id)?.tamanho} {itemFor(e.material_id)?.identificacao}</p>{e.observacoes && <p className="max-w-64 break-words text-xs text-muted-foreground">{e.observacoes}</p>}</td><td className="px-3"><p>{personFor(e.colaborador_id)?.nome ?? "Colaborador indisponível"}</p><p className="text-xs text-muted-foreground">{personFor(e.colaborador_id)?.matricula}</p></td><td className="px-3">{postFor(e.posto_id)}</td><td className="px-3">{e.quantidade}</td><td className="px-3 whitespace-nowrap">{fmt(e.data_entrega)}</td><td className="px-3"><Badge variant={e.data_devolucao ? "secondary" : "outline"}>{e.data_devolucao ? "Devolvido" : "Em uso"}</Badge></td><td className="px-3 whitespace-nowrap">{e.data_devolucao ? <>{fmt(e.data_devolucao)}<p className="text-xs text-muted-foreground">{e.condicao_devolucao === "bom" ? "Bom estado" : e.condicao_devolucao === "danificado" ? "Danificado" : "Inutilizado"}</p></> : "—"}</td><td className="px-3">{!e.data_devolucao && <Button size="icon" variant="ghost" title="Registrar devolução" aria-label={`Devolver ${itemFor(e.material_id)?.nome} de ${personFor(e.colaborador_id)?.nome}`} onClick={() => setDialog({ mode: "devolucao", id: e.id, minimumDate: e.data_entrega })}><RotateCcw /></Button>}</td></tr>)}</tbody></table></div>}
    </> : !items.length ? <EmptyState text="Nenhum material cadastrado." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <article key={i.id} className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4">{i.categoria === "uniforme" ? <Shirt className="h-6 w-6 shrink-0 text-primary" /> : <Package className="h-6 w-6 shrink-0 text-primary" />}<div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{i.nome}</h2><p className="mt-1 text-xs text-muted-foreground">{i.categoria === "uniforme" ? "Uniforme" : "Equipamento"}{i.tamanho && ` · ${i.tamanho}`}</p><p className="break-words text-xs text-muted-foreground">{i.identificacao}</p></div>{manage && <Button variant="ghost" size="icon" disabled={busy} title="Arquivar material" aria-label={`Arquivar ${i.nome}`} onClick={() => archive(i.id)}><Archive /></Button>}</article>)}</div>}
    {dialog && <MateriaisDialog {...dialog} items={active.map((i) => ({ id: i.id, nome: `${i.nome}${i.tamanho ? ` · ${i.tamanho}` : ""}${i.identificacao ? ` · ${i.identificacao}` : ""}` }))} people={data.people} posts={data.posts} onClose={() => setDialog(null)} />}
  </div>;
}