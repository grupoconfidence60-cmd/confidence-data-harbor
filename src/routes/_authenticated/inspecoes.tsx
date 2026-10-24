import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Archive, Download, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { canCreateInspecoes, canManageChecklists } from "@/lib/labels";
import { useMe } from "@/lib/use-me";

type Status = "conforme" | "nao_conforme" | "na";
type Resposta = { item: string; status: Status; obs?: string };
const STATUS: Record<Status, string> = { conforme: "Conforme", nao_conforme: "Não conforme", na: "Não se aplica" };

const inspecoesQuery = queryOptions({
  queryKey: ["inspecoes"],
  queryFn: async () => {
    const [modelos, inspecoes, postos] = await Promise.all([
      supabase.from("checklist_modelos").select("*").order("nome"),
      supabase.from("inspecoes").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(500),
      supabase.from("postos").select("id,nome,ativo").order("nome"),
    ]);
    for (const r of [modelos, inspecoes, postos]) if (r.error) throw r.error;
    return { modelos: modelos.data ?? [], inspecoes: inspecoes.data ?? [], postos: postos.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/inspecoes")({
  head: () => ({ meta: [
    { title: "Checklists de inspeção — Grupo Confidence" },
    { name: "description", content: "Checklists de inspeção dos postos Confidence com itens conformes e não conformes." },
    { property: "og:title", content: "Checklists de inspeção — Grupo Confidence" },
    { property: "og:description", content: "Inspeções por posto com histórico e exportação Excel." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(inspecoesQuery),
  component: () => <RequireModule module="inspecoes"><Inspecoes /></RequireModule>,
});

function Inspecoes() {
  const { data } = useSuspenseQuery(inspecoesQuery);
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const qc = useQueryClient();
  const [tab, setTab] = useState("historico");
  const [post, setPost] = useState("todos");
  const [dialog, setDialog] = useState<"modelo" | "inspecao" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const ativos = data.modelos.filter((m) => !m.arquivado);
  const postoNome = (id: string) => data.postos.find((p) => p.id === id)?.nome ?? "Posto indisponível";
  const modeloNome = (id: string) => data.modelos.find((m) => m.id === id)?.nome ?? "Checklist";
  const lista = data.inspecoes.filter((i) => post === "todos" || i.posto_id === post);
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
  const refresh = () => qc.invalidateQueries({ queryKey: ["inspecoes"] });

  async function archive(id: string) {
    if (!window.confirm("Arquivar este checklist? As inspeções já feitas serão preservadas.")) return;
    const r = await supabase.from("checklist_modelos").update({ arquivado: true }).eq("id", id).select("id").single();
    if (r.error) { toast.error("Não foi possível arquivar."); return; }
    await refresh(); toast.success("Checklist arquivado.");
  }
  function exportar() {
    const rows = lista.flatMap((i) => (i.respostas as Resposta[]).map((r) => [fmt(i.data), postoNome(i.posto_id), modeloNome(i.modelo_id), r.item, STATUS[r.status], r.obs ?? "", i.observacoes]));
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Checklists de inspeção"], ["Data", "Posto", "Checklist", "Item", "Resultado", "Observação do item", "Observações gerais"], ...rows]);
    sheet["!cols"] = [12, 28, 28, 40, 16, 32, 40].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, sheet, "Inspeções");
    XLSX.writeFile(book, "Confidence-Inspecoes.xlsx");
  }

  return <div>
    <PageHeader title="Checklists de inspeção" description="Modelos · Inspeções por posto · Não conformidades" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportar} disabled={!lista.length}><Download />Excel</Button>{canManageChecklists(roles) && <Button variant="outline" onClick={() => setDialog("modelo")}><Plus />Checklist</Button>}{canCreateInspecoes(roles) && <Button onClick={() => setDialog("inspecao")} disabled={!ativos.length || !data.postos.length}><Plus />Nova inspeção</Button>}</div>} />
    <div className="mb-6 grid grid-cols-3 divide-x border-y py-4">{[["Checklists ativos", ativos.length], ["Inspeções", data.inspecoes.length], ["Com não conformidade", data.inspecoes.filter((i) => i.nao_conformes > 0).length]].map(([l, v]) => <div key={l} className="px-3 sm:px-5"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}</div>
    <div className="mb-4 flex flex-wrap items-center gap-3"><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="historico">Inspeções</TabsTrigger><TabsTrigger value="modelos">Checklists</TabsTrigger></TabsList></Tabs>{tab === "historico" && <Select value={post} onValueChange={setPost}><SelectTrigger className="w-full sm:ml-auto sm:w-64" aria-label="Filtrar posto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os postos</SelectItem>{data.postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select>}</div>
    {tab === "historico" ? (!lista.length ? <EmptyState text="Nenhuma inspeção registrada." /> : <div className="space-y-2">{lista.map((i) => <article key={i.id} className="rounded-lg border bg-card">
      <button type="button" className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
        <ListChecks className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{modeloNome(i.modelo_id)}</p><p className="text-xs text-muted-foreground">{postoNome(i.posto_id)} · {fmt(i.data)}</p></div>
        <Badge variant={i.nao_conformes ? "destructive" : "secondary"}>{i.nao_conformes ? `${i.nao_conformes} não conforme(s)` : "Tudo conforme"}</Badge>
      </button>
      {open === i.id && <div className="border-t p-4 text-sm"><ul className="space-y-1">{(i.respostas as Resposta[]).map((r, n) => <li key={n} className="flex flex-wrap justify-between gap-2"><span>{r.item}{r.obs && <span className="block text-xs text-muted-foreground">{r.obs}</span>}</span><span className={r.status === "nao_conforme" ? "font-medium text-destructive" : "text-muted-foreground"}>{STATUS[r.status]}</span></li>)}</ul>{i.observacoes && <p className="mt-3 break-words text-muted-foreground">{i.observacoes}</p>}</div>}
    </article>)}</div>)
    : !ativos.length ? <EmptyState text="Nenhum checklist cadastrado." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{ativos.map((m) => <article key={m.id} className="flex items-start gap-3 rounded-lg border bg-card p-4"><ListChecks className="h-6 w-6 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{m.nome}</h2><p className="text-xs text-muted-foreground">{m.itens.length} itens</p></div>{canManageChecklists(roles) && <Button variant="ghost" size="icon" aria-label={`Arquivar ${m.nome}`} onClick={() => archive(m.id)}><Archive /></Button>}</article>)}</div>}
    {dialog === "modelo" && <ModeloDialog onClose={() => setDialog(null)} onSaved={refresh} />}
    {dialog === "inspecao" && <InspecaoDialog modelos={ativos} postos={data.postos.filter((p) => p.ativo)} userId={me?.id ?? ""} onClose={() => setDialog(null)} onSaved={refresh} />}
  </div>;
}

function ModeloDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const itens = texto.split("\n").map((s) => s.trim()).filter(Boolean);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await supabase.from("checklist_modelos").insert({ nome: nome.trim(), itens }).select("id").single();
    setBusy(false);
    if (r.error) { toast.error("Não foi possível salvar o checklist."); return; }
    await onSaved(); toast.success("Checklist cadastrado."); onClose();
  }
  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Novo checklist</DialogTitle><DialogDescription>Um item por linha.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      <div className="space-y-2"><Label htmlFor="ck-nome">Nome</Label><Input id="ck-nome" required maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="ck-itens">Itens a verificar</Label><Textarea id="ck-itens" rows={8} placeholder={"Uniforme completo\nRádio funcionando\nLivro de ocorrências atualizado"} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy || !nome.trim() || !itens.length || itens.length > 60}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}

function InspecaoDialog({ modelos, postos, userId, onClose, onSaved }: { modelos: { id: string; nome: string; itens: string[] }[]; postos: { id: string; nome: string }[]; userId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [modeloId, setModeloId] = useState("");
  const [posto, setPosto] = useState("");
  const [data, setData] = useState(new Date().toLocaleDateString("sv-SE"));
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  function escolher(id: string) { setModeloId(id); setRespostas((modelos.find((m) => m.id === id)?.itens ?? []).map((item) => ({ item, status: "conforme" }))); }
  const set = (n: number, patch: Partial<Resposta>) => setRespostas((rs) => rs.map((r, i) => (i === n ? { ...r, ...patch } : r)));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await supabase.from("inspecoes").insert({ modelo_id: modeloId, posto_id: posto, data, respostas, observacoes: obs.trim(), realizado_por: userId }).select("id").single();
    setBusy(false);
    if (r.error) { toast.error("Não foi possível registrar. Confira se o posto está sob sua responsabilidade."); return; }
    await onSaved(); toast.success("Inspeção registrada."); onClose();
  }
  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Nova inspeção</DialogTitle><DialogDescription>Marque cada item verificado no posto.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2"><Label>Checklist</Label><Select value={modeloId} onValueChange={escolher}><SelectTrigger aria-label="Checklist"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{modelos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Posto</Label><Select value={posto} onValueChange={setPosto}><SelectTrigger aria-label="Posto"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="insp-data">Data</Label><Input id="insp-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} /></div>
      </div>
      {respostas.length > 0 && <div className="divide-y rounded-lg border">{respostas.map((r, n) => <div key={n} className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{r.item}</span><div className="flex gap-1" role="group" aria-label={r.item}>{(Object.keys(STATUS) as Status[]).map((s) => <Button key={s} type="button" size="sm" aria-pressed={r.status === s} variant={r.status === s ? (s === "nao_conforme" ? "destructive" : "default") : "outline"} onClick={() => set(n, { status: s })}>{STATUS[s]}</Button>)}</div></div>
        {r.status === "nao_conforme" && <Input aria-label={`Observação: ${r.item}`} placeholder="O que foi encontrado?" maxLength={300} value={r.obs ?? ""} onChange={(e) => set(n, { obs: e.target.value })} />}
      </div>)}</div>}
      <div className="space-y-2"><Label htmlFor="insp-obs">Observações gerais</Label><Textarea id="insp-obs" maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy || !modeloId || !posto || !respostas.length}>{busy ? "Salvando…" : "Registrar inspeção"}</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}
