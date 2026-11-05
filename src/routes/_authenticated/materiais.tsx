import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Package, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { MateriaisDialog } from "@/components/materiais-dialog";
import { MaterialEstoque } from "@/components/material-estoque";
import { UniformesCatalogo } from "@/components/uniformes-catalogo";
import { ehUniforme } from "@/lib/uniformes";
import { HistoricoPlanilha } from "@/components/historico-planilha";

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
  const showHist = (me?.roles ?? []).some((r) => ["admin", "gestor", "rh", "supervisor"].includes(r));
  const qc = useQueryClient();
  const [tab, setTab] = useState("estoque");
  const [search, setSearch] = useState("");
  const [post, setPost] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ mode: "item" | "entrega" | "devolucao"; id?: string; minimumDate?: string; initialMaterialId?: string } | null>(null);
  const active = data.items.filter((i) => !i.arquivado);
  const itemFor = (id: string) => data.items.find((i) => i.id === id);
  const personFor = (id: string) => data.people.find((c) => c.id === id);
  const postFor = (id: string) => data.posts.find((p) => p.id === id)?.nome ?? "Posto indisponível";
  const matches = (text: string) => text.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  const isTestRadio = (materialId: string) => {
    const item = itemFor(materialId);
    if (!item) return false;
    const description = `${item.nome} ${item.identificacao ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    return /\bradios?\b/.test(description) && /\btestes?\b/.test(description);
  };
  const deliveries = data.deliveries.filter((e) => !isTestRadio(e.material_id) && (post === "todos" || e.posto_id === post) && (status === "todos" || (status === "devolvidos") === Boolean(e.data_devolucao)) && matches(`${itemFor(e.material_id)?.nome} ${personFor(e.colaborador_id)?.nome} ${personFor(e.colaborador_id)?.matricula} ${postFor(e.posto_id)}`));
  const items = active.filter((i) => matches(`${i.nome} ${i.tamanho} ${i.identificacao} ${i.grupo}`));
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
  return <div className="mx-auto w-full max-w-6xl text-foreground">
    <PageHeader title="Equipamentos e uniformes" description="Estoque, entregas e catálogo." />
    <div className="mb-4 space-y-4 rounded-lg border bg-card p-4">
      <Tabs value={tab} onValueChange={(value) => { setTab(value); setSearch(""); }}><TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4"><TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="estoque">Estoque</TabsTrigger><TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="entregas">Entregas</TabsTrigger><TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="catalogo">Catálogo</TabsTrigger>{showHist && <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="historico">Histórico</TabsTrigger>}</TabsList></Tabs>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <h2 className="font-semibold">{tab === "estoque" ? "Saldo por material" : tab === "entregas" ? "Quem recebeu" : tab === "catalogo" ? "Materiais cadastrados" : "Histórico da planilha (até out/2026)"}</h2>
        <div className="flex shrink-0 flex-wrap gap-2">{tab === "catalogo" && manage && <Button onClick={() => setDialog({ mode: "item" })}><Plus />Cadastrar material</Button>}{tab === "entregas" && <><Button variant="outline" onClick={exportRows} disabled={!deliveries.length}><Download />Exportar entregas</Button><Button onClick={() => setDialog({ mode: "entrega" })} disabled={!active.length || !data.people.length || !data.posts.length}><Plus />Registrar entrega</Button></>}</div>
      </div>
      {tab !== "historico" && <div className="relative w-full"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={tab === "entregas" ? "Buscar entregas por material, colaborador ou posto" : "Buscar material, tamanho ou identificação"} placeholder={tab === "entregas" ? "Buscar material, colaborador, matrícula ou posto…" : "Buscar material, tamanho ou identificação…"} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
    </div>
    {tab === "historico" ? <HistoricoPlanilha /> : tab === "estoque" ? <MaterialEstoque items={items} canEditSizes={manage} people={data.people.filter((c) => !c.arquivado)} posts={data.posts.filter((p) => p.ativo)} canFull={(me?.roles ?? []).some((r) => r === "admin" || r === "rh")} /> : tab === "entregas" ? <>
      <div className="mb-4 flex flex-wrap gap-3"><Select value={post} onValueChange={setPost}><SelectTrigger className="w-full sm:w-64" aria-label="Filtrar posto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os postos</SelectItem>{data.posts.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44" aria-label="Filtrar situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="em_uso">Em uso</SelectItem><SelectItem value="devolvidos">Devolvidos</SelectItem></SelectContent></Select></div>
      {!deliveries.length ? <EmptyState text="Nenhuma entrega encontrada." /> : <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[850px]"><thead><tr>{["Material", "Colaborador", "Posto", "Qtd.", "Entrega", "Situação", "Devolução", ""].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{deliveries.map((e) => <tr key={e.id} className="border-t"><td className="px-3 py-3"><p className="font-medium">{itemFor(e.material_id)?.nome}</p><p className="text-xs text-muted-foreground">{itemFor(e.material_id)?.tamanho} {itemFor(e.material_id)?.identificacao}</p>{e.observacoes && <p className="max-w-64 break-words text-xs text-muted-foreground">{e.observacoes}</p>}</td><td className="px-3"><p>{personFor(e.colaborador_id)?.nome ?? "Colaborador indisponível"}</p><p className="text-xs text-muted-foreground">{personFor(e.colaborador_id)?.matricula}</p></td><td className="px-3">{postFor(e.posto_id)}</td><td className="px-3">{e.quantidade}</td><td className="px-3 whitespace-nowrap">{fmt(e.data_entrega)}</td><td className="px-3"><Badge variant={e.data_devolucao ? "secondary" : "outline"}>{e.data_devolucao ? "Devolvido" : "Em uso"}</Badge></td><td className="px-3 whitespace-nowrap">{e.data_devolucao ? <>{fmt(e.data_devolucao)}<p className="text-xs text-muted-foreground">{e.condicao_devolucao === "bom" ? "Bom estado" : e.condicao_devolucao === "danificado" ? "Danificado" : "Inutilizado"}</p></> : "—"}</td><td className="px-3">{!e.data_devolucao && <Button size="icon" variant="ghost" title="Registrar devolução" aria-label={`Devolver ${itemFor(e.material_id)?.nome} de ${personFor(e.colaborador_id)?.nome}`} onClick={() => setDialog({ mode: "devolucao", id: e.id, minimumDate: e.data_entrega })}><RotateCcw /></Button>}</td></tr>)}</tbody></table></div>}
    </> : !items.length ? <EmptyState text="Nenhum material encontrado. Ajuste a busca ou cadastre um material." /> : <div className="space-y-5">
      {items.some((i) => ehUniforme(i.categoria)) && <UniformesCatalogo items={items} canManage={manage} onArchive={archive} busy={busy} />}
      {items.some((i) => !ehUniforme(i.categoria)) && <section className="overflow-hidden rounded-lg border bg-card" aria-label="Equipamentos"><div className="border-b bg-muted/50 px-4 py-3"><h2 className="font-semibold">Equipamentos e materiais</h2><p className="text-xs text-muted-foreground">Identificação e tamanho de cada material cadastrado.</p></div><div className="divide-y">{items.filter((i) => !ehUniforme(i.categoria)).map((i) => <article key={i.id} className="flex min-w-0 items-center gap-3 px-4 py-3"><Package className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{i.nome}</h3><p className="break-words text-xs text-muted-foreground">Tamanho: {i.tamanho || "Não informado"} · Identificação: {i.identificacao || "Não informada"}</p></div>{manage && <Button variant="ghost" size="icon" disabled={busy} title="Arquivar material" aria-label={`Arquivar ${i.nome}`} onClick={() => archive(i.id)}><Archive /></Button>}</article>)}</div></section>}
    </div>}
    {dialog && <MateriaisDialog {...dialog} items={active.map((i) => ({ id: i.id, nome: `${i.nome}${i.tamanho ? ` · ${i.tamanho}` : ""}${i.identificacao ? ` · ${i.identificacao}` : ""}` }))} people={data.people.filter((c) => !c.arquivado)} posts={data.posts.filter((p) => p.ativo)} onClose={() => setDialog(null)} />}
  </div>;
}