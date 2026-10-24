import { FuncaoBadge } from "@/components/funcao-badge";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Download, Pencil, Plus, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/page";
import { canManagePlanilha, dayStatus, downloadSchedule, monthDays, rosterMove, type PlanilhaRow, type PlanilhaPerson } from "@/lib/planilha";
import { RosterLists, type RosterEdit } from "@/components/roster-lists";
import { ESCALA_OPTIONS, escalaLabel, escalaFromJornada } from "@/lib/escala-options";
import { useMe } from "@/lib/use-me";

type Person = PlanilhaPerson & { posto_id: string | null; jornada: string | null };
type Form = { id?: string; colaborador_id: string; paridade: string; escala_tipo?: string | null | undefined; turno: string; hora_inicio: string; hora_fim: string; observacoes: string; posicao?: string };
const empty: Form = { colaborador_id: "", paridade: "impar", escala_tipo: "livre", turno: "diurno", hora_inicio: "06:00", hora_fim: "18:00", observacoes: "", posicao: "" };

export function PostoPlanilha({ posto }: { posto: { id: string; nome: string; supervisor_id: string | null } }) {
  const { data: me } = useMe();
  const allowed = canManagePlanilha(me?.roles ?? [], me?.id, posto.supervisor_id);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [editing, setEditing] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [source, setSource] = useState<{ id: string; day: number } | null>(null);
  const [view, setView] = useState("listas");
  const qc = useQueryClient();
  const key = ["posto-planilha", posto.id, month];
  const { data, isPending, isError } = useQuery({
    queryKey: key,
    enabled: allowed && /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const [allocations, people] = await Promise.all([
        supabase.from("posto_planilha").select("*").eq("posto_id", posto.id).eq("mes", `${month}-01`).order("created_at"),
        supabase.from("colaboradores").select("id,nome,matricula,posto_id,jornada,arquivado,situacao,funcoes(nome)").order("nome"),
      ]);
      if (allocations.error) throw allocations.error;
      if (people.error) throw people.error;
      return { allocations: allocations.data, people: people.data };
    },
  });
  const rows = (data?.allocations ?? []).filter((r) => !r.removido);
  const people: Person[] = data?.people ?? [];
  const candidates = (data?.people ?? []).filter((p) => !p.arquivado && p.situacao !== "desligado");
  const days = Array.from({ length: monthDays(month) }, (_, i) => i + 1);
  const visible = rows.filter((r) => {
    const person = people.find((p) => p.id === r.colaborador_id);
    return (filter === "todos" || (r.escala_tipo ?? r.paridade) === filter) && `${person?.nome ?? ""} ${person?.matricula ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  });
  async function update(id: string, payload: RosterEdit & { ajustes?: Record<string, string> }) {
    if (busy) return false;
    setBusy(true);
    try {
      const { error } = await supabase.from("posto_planilha").update(payload).eq("id", id).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: key });
      return true;
    } catch { toast.error("Não foi possível salvar a alteração."); return false; }
    finally { setBusy(false); }
  }
  function toggleDay(row: PlanilhaRow, day: number) {
    const adjustments = row.ajustes && typeof row.ajustes === "object" && !Array.isArray(row.ajustes) ? row.ajustes as Record<string, string> : {};
    const next = dayStatus(row, day, month) === "T" ? "F" : "T";
    const base = dayStatus({ paridade: row.paridade, escala_tipo: row.escala_tipo, ajustes: {} }, day, month);
    const edits = { ...adjustments };
    if (next === base) delete edits[String(day)]; else edits[String(day)] = next;
    void update(row.id, { ajustes: edits });
  }
  async function swap(target: { id: string; day: number }, origin = source) {
    if (!origin || busy || (origin.id === target.id && origin.day === target.day)) { setSource(null); return; }
    setBusy(true);
    const { error } = await supabase.rpc("trocar_plantao", { origem: origin.id, destino: target.id, dia_origem: origin.day, dia_destino: target.day });
    if (error) toast.error("Não foi possível trocar os plantões.");
    else { await qc.invalidateQueries({ queryKey: key }); toast.success("Plantões trocados."); }
    setSource(null); setBusy(false);
  }
  if (!allowed) return <p className="text-muted-foreground">Você não tem permissão para organizar a escala deste posto.</p>;
  return <section className="mt-7 min-w-0">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-lg font-semibold">Planilha mensal de colaboradores</h2><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>{rows.length} colaborador(es)</span><span>{rows.filter((r) => (r.escala_tipo ?? r.paridade) === "par").length} pares</span><span>{rows.filter((r) => (r.escala_tipo ?? r.paridade) === "impar").length} ímpares</span></div></div>
      <div className="flex flex-wrap gap-2">{view === "dias" && <Button variant={swapMode ? "secondary" : "outline"} aria-pressed={swapMode} onClick={() => { setSwapMode(!swapMode); setSource(null); }}><ArrowLeftRight className="h-4 w-4" />Trocar plantões</Button>}<Button variant="outline" disabled={isPending || isError || busy} onClick={() => downloadSchedule(posto.nome, month, rows, people)}><Download className="h-4 w-4" />Baixar Excel</Button><Button disabled={isPending || isError || busy} onClick={() => setEditing(empty)}><Plus className="h-4 w-4" />Incluir colaborador</Button></div>
    </div>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="space-y-2"><Label htmlFor="planilha-mes">Mês</Label><Input id="planilha-mes" className="w-44" type="month" value={month} disabled={busy} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setSource(null); } }} /></div>
      <div className="space-y-2"><Label>Escala</Label><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-56" aria-label="Filtrar escala"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{ESCALA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar colaborador na planilha" placeholder="Nome ou matrícula" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="flex gap-1 self-end border-b" role="tablist" aria-label="Visualização da planilha"><Button role="tab" aria-selected={view === "listas"} variant={view === "listas" ? "secondary" : "ghost"} onClick={() => setView("listas")}>Colaboradores · Par / Ímpar</Button><Button role="tab" aria-selected={view === "dias"} variant={view === "dias" ? "secondary" : "ghost"} onClick={() => setView("dias")}>Dias do mês</Button></div>
    </div>
    {isPending ? <p className="text-muted-foreground">Carregando planilha…</p> : isError ? <p className="text-destructive" role="alert">Não foi possível carregar a planilha.</p> : view === "listas" ? <RosterLists post={posto.nome} rows={visible} people={people} busy={busy} save={update} move={(id, type, turno) => { void update(id, rosterMove(type, turno)); }} add={(type, turno) => setEditing({ ...empty, ...rosterMove(type, turno), hora_inicio: turno === "noturno" ? "18:00" : "06:00", hora_fim: turno === "noturno" ? "06:00" : "18:00" })} edit={(row) => setEditing({ ...row, hora_inicio: row.hora_inicio.slice(0, 5), hora_fim: row.hora_fim.slice(0, 5) })} /> : visible.length === 0 ? <EmptyState text="Nenhum colaborador nesta planilha." /> : <div className="max-w-full overflow-x-auto rounded-lg border bg-card">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead><tr><th className="sticky left-0 z-20 w-64 min-w-64 border-b border-r bg-muted px-4 text-left">Colaborador / matrícula</th><th className="min-w-28 border-b px-3 text-left">Função</th><th className="min-w-32 border-b px-3 text-left">Escala / turno</th>{days.map((day) => <th key={day} className="w-10 min-w-10 border-b px-1 text-center"><div>{day.toString().padStart(2, "0")}</div><div className="mt-1 text-[10px] font-normal text-muted-foreground">{new Date(`${month}-${String(day).padStart(2, "0")}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}</div></th>)}<th className="min-w-20 border-b px-3">Plantões</th><th className="min-w-24 border-b px-3">Ações</th></tr></thead>
        <tbody>{visible.map((row) => {
          const person = people.find((p) => p.id === row.colaborador_id);
          return <tr key={row.id} className="border-b last:border-b-0"><td className="sticky left-0 z-10 w-64 min-w-64 max-w-64 border-r bg-card px-4"><div className="break-words font-semibold">{person?.nome ?? "Colaborador indisponível"}</div><div className="mt-1 text-muted-foreground">{person?.matricula ?? "—"}</div></td><td className="max-w-40 px-3"><FuncaoBadge nome={person?.funcoes?.nome} /></td><td className="px-3"><div className="font-medium">{escalaLabel(row.escala_tipo ?? row.paridade)} · {row.turno === "diurno" ? "Diurno" : "Noturno"}</div><div className="mt-1 text-muted-foreground">{row.hora_inicio.slice(0, 5)}–{row.hora_fim.slice(0, 5)}</div></td>{days.map((day) => {
            const status = dayStatus(row, day, month);
            return <td key={day} className="px-1 text-center" onDragOver={(e) => { if (!busy) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const raw = e.dataTransfer.getData("application/confidence-cell"); try { const cell = JSON.parse(raw); if (typeof cell.id === "string" && Number.isInteger(cell.day)) void swap({ id: row.id, day }, cell); } catch { setSource(null); } }}><Button draggable={!busy} onDragStart={(e) => { setSource({ id: row.id, day }); e.dataTransfer.setData("application/confidence-cell", JSON.stringify({ id: row.id, day })); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setSource(null)} size="icon" variant={status === "T" ? "secondary" : "ghost"} className={`h-8 w-8 cursor-grab active:cursor-grabbing ${status === "T" ? "text-primary" : "text-muted-foreground"} ${source?.id === row.id && source.day === day ? "ring-2 ring-primary" : ""}`} disabled={busy} title={`${person?.nome}: ${day}/${month.slice(5)}, ${status === "T" ? "Trabalho" : "Folga"}`} aria-label={`${person?.nome}, dia ${day}, ${status === "T" ? "Trabalho" : "Folga"}`} onClick={() => { if (swapMode) { if (source) void swap({ id: row.id, day }); else setSource({ id: row.id, day }); } else toggleDay(row, day); }}>{status}</Button></td>;
          })}<td className="px-3 text-center font-semibold">{days.filter((day) => dayStatus(row, day, month) === "T").length}</td><td className="px-3"><div className="flex"><Button size="icon" variant="ghost" disabled={busy} title="Editar escala" aria-label={`Editar escala de ${person?.nome}`} onClick={() => setEditing({ ...row, hora_inicio: row.hora_inicio.slice(0, 5), hora_fim: row.hora_fim.slice(0, 5) })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={busy} title="Retirar da planilha" aria-label={`Retirar ${person?.nome} da planilha`} onClick={() => { if (window.confirm(`Retirar ${person?.nome} da planilha de ${month}?`)) void update(row.id, { removido: true }); }}><UserMinus className="h-4 w-4 text-destructive" /></Button></div></td></tr>;
        })}<tr className="bg-muted"><td className="sticky left-0 z-10 border-r bg-muted px-4 font-semibold" colSpan={3}>Efetivo previsto por dia</td>{days.map((day) => <td key={day} className="px-1 text-center font-semibold">{visible.filter((row) => dayStatus(row, day, month) === "T").length}</td>)}<td colSpan={2} /></tr></tbody>
      </table>
    </div>}
    {editing && <PlanilhaDialog value={editing} people={candidates} postoId={posto.id} month={month} existing={data?.allocations ?? []} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: key })} />}
  </section>;
}

function PlanilhaDialog({ value, people, postoId, month, existing, onClose, onSaved }: { value: Form; people: Person[]; postoId: string; month: string; existing: (PlanilhaRow & { removido: boolean })[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const available = people.filter((p) => (p.id === form.colaborador_id || !existing.some((r) => r.colaborador_id === p.id && !r.removido)) && `${p.nome} ${p.matricula}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !form.colaborador_id) return;
    setSaving(true);
    const removed = existing.find((r) => r.colaborador_id === form.colaborador_id && r.removido);
    const id = form.id ?? removed?.id;
    const payload = { escala_tipo: form.escala_tipo ?? form.paridade, colaborador_id: form.colaborador_id, paridade: form.paridade, turno: form.turno, hora_inicio: form.hora_inicio, hora_fim: form.hora_fim, observacoes: form.observacoes, posicao: form.posicao ?? "", removido: false };
    const result = id ? await supabase.from("posto_planilha").update(payload).eq("id", id).select("id").single() : await supabase.from("posto_planilha").insert({ ...payload, posto_id: postoId, mes: `${month}-01` }).select("id").single();
    if (result.error) { setSaving(false); toast.error(result.error.code === "23505" ? "Colaborador já incluído neste mês." : "Não foi possível salvar a escala."); return; }
    await onSaved();
    toast.success("Escala salva.");
    onClose();
  }
  return <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{form.id ? "Editar escala" : "Incluir colaborador"}</DialogTitle></DialogHeader><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
    {!form.id && <div className="space-y-2 sm:col-span-2"><Label htmlFor="buscar-pessoa">Buscar colaborador</Label><Input id="buscar-pessoa" placeholder="Nome ou matrícula" value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v, escala_tipo: value.escala_tipo === "livre" ? escalaFromJornada(people.find((p) => p.id === v)?.jornada) : form.escala_tipo })}><SelectTrigger aria-label="Selecionar colaborador"><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger><SelectContent>{available.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} · {p.matricula}{p.posto_id === postoId ? " · deste posto" : ""}</SelectItem>)}</SelectContent></Select></div>}
    <div className="space-y-2"><Label>Escala</Label><Select value={form.escala_tipo ?? form.paridade} onValueChange={(v) => setForm({ ...form, escala_tipo: v })}><SelectTrigger aria-label="Tipo de escala"><SelectValue /></SelectTrigger><SelectContent>{ESCALA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-2"><Label>Turno</Label><Select value={form.turno} onValueChange={(v) => setForm({ ...form, turno: v, hora_inicio: v === "noturno" ? "18:00" : "06:00", hora_fim: v === "noturno" ? "06:00" : "18:00" })}><SelectTrigger aria-label="Turno da escala"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diurno">Diurno</SelectItem><SelectItem value="noturno">Noturno</SelectItem></SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor="escala-entrada">Entrada</Label><Input id="escala-entrada" type="time" required value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="escala-saida">Saída</Label><Input id="escala-saida" type="time" required value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="escala-posicao">Posição de trabalho</Label><Input id="escala-posicao" value={form.posicao ?? ""} onChange={(e) => setForm({ ...form, posicao: e.target.value })} /></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="escala-observacoes">Observações</Label><Textarea id="escala-observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div><DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !form.colaborador_id}>{saving ? "Salvando…" : "Salvar escala"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}