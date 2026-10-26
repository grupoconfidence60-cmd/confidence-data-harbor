import { useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
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
import { MOV_LABELS, saldo, pendentes } from "@/lib/estoque";

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

export function MaterialEstoque({ items, people, posts, canFull }: { items: Item[]; people: Person[]; posts: Opt[]; canFull: boolean }) {
  const { data } = useQuery(movQuery);
  const movs = data?.movs ?? [];
  const profiles = data?.profiles ?? [];
  const [open, setOpen] = useState(false);
  const [fPost, setFPost] = useState("todos");
  const [fPerson, setFPerson] = useState("todos");
  const [fSup, setFSup] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const name = (list: Opt[], id: string | null) => (id ? list.find((x) => x.id === id)?.nome ?? "—" : "—");
  const day = (iso: string) => iso.slice(0, 10);
  const hist = movs.filter((m) => (fPost === "todos" || m.posto_id === fPost) && (fPerson === "todos" || m.colaborador_id === fPerson) && (fSup === "todos" || m.supervisor_id === fSup) && (!from || day(m.created_at) >= from) && (!to || day(m.created_at) <= to));
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  function exportar() {
    const book = XLSX.utils.book_new();
    const est = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Estoque"], ["Material", "Categoria", "Tamanho", "Em estoque", "Entregues pendentes"], ...items.map((i) => [i.nome, i.categoria, i.tamanho, saldo(movs, i.id), pendentes(movs, i.id)])]);
    const mov = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Movimentações"], ["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por", "Motivo"], ...hist.map((m) => [fmt(m.created_at), MOV_LABELS[m.tipo], name(items, m.material_id), m.quantidade, name(people, m.colaborador_id), name(posts, m.posto_id), name(profiles, m.supervisor_id), name(profiles, m.registrado_por), m.motivo])]);
    XLSX.utils.book_append_sheet(book, est, "Estoque");
    XLSX.utils.book_append_sheet(book, mov, "Movimentações");
    XLSX.writeFile(book, "Confidence-Estoque-Materiais.xlsx");
  }

  const sel = (label: string, v: string, set: (v: string) => void, opts: Opt[], all: string) => <Select value={v} onValueChange={set}><SelectTrigger className="w-full sm:w-52" aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">{all}</SelectItem>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select>;

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2"><Button onClick={() => setOpen(true)} disabled={!items.length}><Plus />Nova movimentação</Button><Button variant="outline" onClick={exportar}><Download />Excel de conferência</Button></div>
    <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[560px]"><thead><tr>{["Material", "Tamanho", "Em estoque", "Entregues (pendentes de devolução)"].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{items.map((i) => { const s = saldo(movs, i.id); return <tr key={i.id} className="border-t"><td className="px-3 py-2 font-medium">{i.nome}</td><td className="px-3">{i.tamanho || "—"}</td><td className="px-3"><Badge variant={s > 0 ? "secondary" : "destructive"}>{s}</Badge></td><td className="px-3">{pendentes(movs, i.id)}</td></tr>; })}</tbody></table></div>
    <div><h2 className="mb-3 font-semibold">Histórico de movimentações</h2>
      <div className="mb-3 flex flex-wrap gap-3">{sel("Filtrar posto", fPost, setFPost, posts, "Todos os postos")}{sel("Filtrar colaborador", fPerson, setFPerson, people, "Todos os colaboradores")}{sel("Filtrar supervisor", fSup, setFSup, profiles, "Todos os supervisores")}<Input type="date" aria-label="De" className="w-full sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" aria-label="Até" className="w-full sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {!hist.length ? <EmptyState text="Nenhuma movimentação encontrada." /> : <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[900px]"><thead><tr>{["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por"].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{hist.map((m) => <tr key={m.id} className="border-t"><td className="px-3 py-2 whitespace-nowrap">{fmt(m.created_at)}</td><td className="px-3"><Badge variant="outline">{MOV_LABELS[m.tipo]}</Badge>{m.motivo && <p className="text-xs text-muted-foreground">{m.motivo}</p>}</td><td className="px-3">{name(items, m.material_id)}</td><td className="px-3">{m.quantidade}</td><td className="px-3">{name(people, m.colaborador_id)}</td><td className="px-3">{name(posts, m.posto_id)}</td><td className="px-3">{name(profiles, m.supervisor_id)}</td><td className="px-3">{name(profiles, m.registrado_por)}</td></tr>)}</tbody></table></div>}
    </div>
    {open && <MovDialog items={items} people={people} posts={posts} profiles={profiles} canFull={canFull} onClose={() => setOpen(false)} />}
  </div>;
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
