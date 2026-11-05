import { useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/page";
import { MaterialTamanho } from "@/components/material-tamanho";
import { UniformeTamanhos } from "@/components/uniforme-tamanhos";
import { ehUniforme, normalizarUniforme } from "@/lib/uniformes";
import { MOV_LABELS, saldo, pendentes, type Mov } from "@/lib/estoque";

type Opt = { id: string; nome: string };
type Item = Opt & { tamanho: string; categoria: string };
type Person = Opt & { matricula: string; posto_id: string | null };

const movQuery = queryOptions({
  queryKey: ["materiais", "movimentacoes"],
  queryFn: async () => {
    const [m, p] = await Promise.all([
      supabase.from("material_movimentacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,nome").eq("status", "ativo").order("nome"),
    ]);
    if (m.error) throw m.error;
    return { movs: m.data ?? [], profiles: p.data ?? [] };
  },
});

export function MaterialEstoque({ items, people, posts, canFull, filterMaterialIds, canEditSizes = false }: { items: Item[]; people: Person[]; posts: Opt[]; canFull: boolean; filterMaterialIds?: string[]; canEditSizes?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery(movQuery);
  const movs = data?.movs ?? [];
  const profiles = data?.profiles ?? [];
  const [open, setOpen] = useState(false);
  const [fPost, setFPost] = useState("todos");
  const [fPerson, setFPerson] = useState("todos");
  const [fSup, setFSup] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const grupos = new Map<string, Item[]>();
  for (const item of items) {
    const key = ehUniforme(item.categoria) ? `uniforme:${normalizarUniforme(item.nome)}` : `material:${item.id}`;
    const grupo = grupos.get(key) ?? [];
    grupo.push(item);
    grupos.set(key, grupo);
  }
  const name = (list: Opt[], id: string | null) => (id ? list.find((x) => x.id === id)?.nome ?? "—" : "—");
  const day = (iso: string) => iso.slice(0, 10);
  const hist = movs.filter((m) => (!filterMaterialIds || filterMaterialIds.includes(m.material_id)) && (fPost === "todos" || m.posto_id === fPost) && (fPerson === "todos" || m.colaborador_id === fPerson) && (fSup === "todos" || m.supervisor_id === fSup) && (!from || day(m.created_at) >= from) && (!to || day(m.created_at) <= to));
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  async function excluir(m: (typeof movs)[number]) {
    const desc = `${MOV_LABELS[m.tipo]} · ${name(items, m.material_id)} · ${m.quantidade} un. · ${fmt(m.created_at)}`;
    if (!window.confirm(`Excluir esta movimentação do histórico?\n\n${desc}\n\nO estoque será recalculado sem este lançamento.`)) return;
    const { error } = await supabase.from("material_movimentacoes").delete().eq("id", m.id);
    if (error) { toast.error("Não foi possível excluir. Confira seu acesso."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Movimentação excluída do histórico.");
  }

  function exportar() {
    const book = XLSX.utils.book_new();
    const est = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Estoque"], ["Material", "Categoria", "Tamanho", "Em estoque", "Entregues pendentes"], ...items.map((i) => [i.nome, i.categoria, i.tamanho, saldo(movs, i.id), pendentes(movs, i.id)])]);
    const mov = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Movimentações"], ["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por", "Motivo"], ...hist.map((m) => [fmt(m.created_at), MOV_LABELS[m.tipo], name(items, m.material_id), m.quantidade, name(people, m.colaborador_id), name(posts, m.posto_id), name(profiles, m.supervisor_id), name(profiles, m.registrado_por), m.motivo])]);
    XLSX.utils.book_append_sheet(book, est, "Estoque");
    XLSX.utils.book_append_sheet(book, mov, "Movimentações");
    XLSX.writeFile(book, "Confidence-Estoque-Materiais.xlsx");
  }

  const sel = (label: string, v: string, set: (v: string) => void, opts: Opt[], all: string) => <Select value={v} onValueChange={set}><SelectTrigger className="w-full sm:w-52" aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">{all}</SelectItem>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select>;

  return <div className="space-y-4 text-foreground">
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Saldo por material">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h3 className="text-sm font-semibold">Estoque por material</h3><p className="mt-1 text-xs text-muted-foreground">Uma linha por uniforme. Selecione o tamanho ao lado para consultar seu saldo e suas pendências.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setOpen(true)} disabled={!items.length}><Plus />Nova movimentação</Button><Button variant="outline" onClick={exportar}><Download />Exportar estoque</Button></div></div>
      {!items.length ? <EmptyState text="Nenhum material encontrado para esta busca." /> : <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr>{["Material", "Tamanho", "Em estoque", "A devolver"].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{[...grupos.entries()].map(([key, grupo]) => <EstoqueLinha key={key} items={grupo} movs={movs} canEditSizes={canEditSizes} />)}</tbody></table></div>}
    </section>
    <details className="rounded-lg border bg-card p-4">
      <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Histórico de movimentações <span className="ml-2 font-normal text-muted-foreground">({hist.length})</span></summary>
      <p className="mb-3 mt-2 text-xs text-muted-foreground">Consulte os lançamentos de estoque usando os filtros abaixo. A busca acima filtra somente o quadro de saldos; este histórico possui filtros próprios.</p>
      <div className="mb-3 flex flex-wrap gap-3">{sel("Filtrar posto", fPost, setFPost, posts, "Todos os postos")}{sel("Filtrar colaborador", fPerson, setFPerson, people, "Todos os colaboradores")}{sel("Filtrar supervisor", fSup, setFSup, profiles, "Todos os supervisores")}<Input type="date" aria-label="De" className="w-full sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" aria-label="Até" className="w-full sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {!hist.length ? <EmptyState text="Nenhuma movimentação encontrada." /> : <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[900px]"><thead><tr>{["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por", ...(canFull ? ["Ações"] : [])].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{hist.map((m) => <tr key={m.id} className="border-t"><td className="px-3 py-2 whitespace-nowrap">{fmt(m.created_at)}</td><td className="px-3"><Badge variant="outline">{MOV_LABELS[m.tipo]}</Badge>{m.motivo && <p className="text-xs text-muted-foreground">{m.motivo}</p>}</td><td className="px-3">{name(items, m.material_id)}</td><td className="px-3">{m.quantidade}</td><td className="px-3">{name(people, m.colaborador_id)}</td><td className="px-3">{name(posts, m.posto_id)}</td><td className="px-3">{name(profiles, m.supervisor_id)}</td><td className="px-3">{name(profiles, m.registrado_por)}</td>{canFull && <td className="px-3"><Button variant="ghost" size="icon" aria-label="Excluir movimentação" onClick={() => excluir(m)}><Trash2 className="text-destructive" /></Button></td>}</tr>)}</tbody></table></div>}
    </details>
    {open && <MovDialog items={items} people={people} posts={posts} profiles={profiles} canFull={canFull} onClose={() => setOpen(false)} />}
  </div>;
}

function EstoqueLinha({ items, movs, canEditSizes }: { items: Item[]; movs: Mov[]; canEditSizes: boolean }) {
  const [selectedId, setSelectedId] = useState("");
  const item = items[0];
  const uniforme = ehUniforme(item.categoria);
  const tamanhos = new Map<string, Item[]>();
  for (const registro of items) {
    const key = normalizarUniforme(registro.tamanho);
    const grupo = tamanhos.get(key) ?? [];
    grupo.push(registro);
    tamanhos.set(key, grupo);
  }
  const opcoes = [...tamanhos.values()].sort((a, b) => a[0].tamanho.localeCompare(b[0].tamanho, "pt-BR", { numeric: true }));
  const selecionados = opcoes.find((grupo) => grupo[0].id === selectedId) ?? opcoes[0];
  const selecionado = selecionados[0];
  const emEstoque = selecionados.reduce((total, registro) => total + saldo(movs, registro.id), 0);
  const aDevolver = selecionados.reduce((total, registro) => total + pendentes(movs, registro.id), 0);

  return <tr className="border-t text-foreground">
    <td className="px-3 py-3 font-medium">{item.nome}</td>
    <td className="px-3 py-2">
      {uniforme ? <div className="flex flex-wrap items-center gap-2">
        <Select value={selecionado.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-44 bg-background" aria-label={`Selecionar tamanho de ${item.nome}`}><SelectValue /></SelectTrigger>
          <SelectContent>{opcoes.map((grupo) => <SelectItem key={grupo[0].id} value={grupo[0].id}>{grupo[0].tamanho.trim() || "Sem tamanho informado"}</SelectItem>)}</SelectContent>
        </Select>
        {canEditSizes && <UniformeTamanhos item={selecionado} label="Adicionar tamanhos" />}
      </div> : canEditSizes ? <MaterialTamanho item={item} /> : item.tamanho || "—"}
    </td>
    <td className="px-3 tabular-nums"><Badge variant={emEstoque > 0 ? "secondary" : "destructive"}>{emEstoque}</Badge></td>
    <td className="px-3 tabular-nums">{aDevolver}</td>
  </tr>;
}

function MovDialog({ items, people, posts, profiles, canFull, onClose }: { items: Item[]; people: Person[]; posts: Opt[]; profiles: Opt[]; canFull: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(canFull ? "entrada" : "entrega");
  const [item, setItem] = useState("");
  const [qtd, setQtd] = useState("1");
  const [person, setPerson] = useState("");
  const [post, setPost] = useState("");
  const [sup, setSup] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const needsPerson = ["entrega", "devolucao", "troca"].includes(tipo);
  const tipos = Object.entries(MOV_LABELS).filter(([k]) => canFull || !["entrada", "baixa"].includes(k)).map(([id, nome]) => ({ id, nome }));
  const ok = item && Number.isInteger(Number(qtd)) && Number(qtd) > 0 && (!needsPerson || (person && post));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    const { error } = await supabase.from("material_movimentacoes").insert({ tipo, material_id: item, quantidade: Number(qtd), colaborador_id: needsPerson ? person : null, posto_id: post || null, supervisor_id: sup || null, motivo: motivo.trim() });
    setBusy(false);
    if (error) { toast.error(error.message.includes("Estoque insuficiente") ? "Estoque insuficiente para este material." : "Não foi possível registrar. Confira os dados e seu acesso."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Movimentação registrada.");
    onClose();
  }
  const s = (label: string, v: string, set: (v: string) => void, opts: Opt[]) => <div className="space-y-2"><Label>{label}</Label><Select value={v} onValueChange={set}><SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Nova movimentação</DialogTitle><DialogDescription>O lançamento fica registrado com seu nome, data e horário.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      {s("Tipo", tipo, setTipo, tipos)}
      {s("Material", item, setItem, items.map((i) => ({ id: i.id, nome: `${i.nome}${i.tamanho ? ` · ${i.tamanho}` : ""}` })))}
      <div className="space-y-2"><Label htmlFor="mov-qtd">Quantidade</Label><Input id="mov-qtd" type="number" min={1} step={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
      {needsPerson && s("Colaborador", person, (v) => { setPerson(v); const p = people.find((c) => c.id === v)?.posto_id; if (p && posts.some((x) => x.id === p)) setPost(p); }, people.map((p) => ({ id: p.id, nome: `${p.matricula} · ${p.nome}` })))}
      {s(needsPerson ? "Posto" : "Posto (opcional)", post, setPost, posts)}
      {s("Supervisor que autorizou", sup, setSup, profiles)}
      <div className="space-y-2"><Label htmlFor="mov-motivo">Motivo / observações</Label><Textarea id="mov-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={!ok || busy}>{busy ? "Salvando…" : "Registrar"}</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}
