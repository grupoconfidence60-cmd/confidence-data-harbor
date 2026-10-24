import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditEscalas } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/escalas")({
  head: () => ({ meta: [
    { title: "Escalas de trabalho — Grupo Confidence" },
    { name: "description", content: "Escalas de trabalho e alocações nos postos Confidence." },
    { property: "og:title", content: "Escalas de trabalho — Grupo Confidence" },
    { property: "og:description", content: "Escalas de trabalho e alocações nos postos Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="escalas"><Escalas /></RequireModule>,
});

type E = { id?: string; posto_id: string; nome: string; tipo: string; hora_inicio: string; hora_fim: string; ativo: boolean; observacoes: string };
const EMPTY: E = { posto_id: "", nome: "", tipo: "12x36", hora_inicio: "06:00", hora_fim: "18:00", ativo: true, observacoes: "" };
const TIPOS = ["12x36", "5x2", "6x1", "4x2", "Diurno", "Noturno", "Escala móvel"];

function Escalas() {
  const { data: me } = useMe();
  const canEdit = canEditEscalas(me?.roles ?? []);
  const [editing, setEditing] = useState<E | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["escalas"],
    queryFn: async () => {
      const [{ data: escalas }, { data: postos }, { data: membros }] = await Promise.all([
        supabase.from("escalas").select("*").order("nome"),
        supabase.from("postos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("escala_colaboradores").select("id, escala_id, colaborador_id, data_inicio, data_fim, colaboradores:colaborador_id(nome, matricula)").is("data_fim", null),
      ]);
      return { escalas: escalas ?? [], postos: postos ?? [], membros: (membros ?? []) as unknown as M[] };
    },
  });
  const postoNome = (id: string) => data?.postos.find((p) => p.id === id)?.nome ?? "—";

  return (
    <div>
      <PageHeader title="Escalas de trabalho" description="Modelos de escala por posto e colaboradores alocados"
        actions={canEdit && <Button onClick={() => setEditing(EMPTY)}><Plus className="mr-1 h-4 w-4" />Nova escala</Button>} />
      {!data?.escalas.length ? <EmptyState text="Nenhuma escala cadastrada." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.escalas.map((e) => {
            const ms = data.membros.filter((m) => m.escala_id === e.id);
            return (
              <Card key={e.id} className={!e.ativo ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{e.nome}</div>
                      <div className="text-sm text-muted-foreground">{postoNome(e.posto_id)} · {e.tipo} · {e.hora_inicio?.slice(0, 5)}–{e.hora_fim?.slice(0, 5)}</div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Alocar colaborador" onClick={() => setAssigning(e.id)}><UserPlus className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing({ ...EMPTY, ...e, observacoes: e.observacoes ?? "" })}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {ms.length === 0 && <span className="text-sm text-muted-foreground">Nenhum colaborador alocado.</span>}
                    {ms.map((m) => <MembroChip key={m.id} m={m} canEdit={canEdit} />)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <EscalaDialog value={editing} postos={data?.postos ?? []} onClose={() => setEditing(null)} />}
      {assigning && <AssignDialog escalaId={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

type M = { id: string; escala_id: string; colaborador_id: string; data_inicio: string; data_fim: string | null; colaboradores: { nome: string; matricula: string } | null };

function MembroChip({ m, canEdit }: { m: M; canEdit: boolean }) {
  const qc = useQueryClient();
  async function remover() {
    const { error } = await supabase.from("escala_colaboradores").update({ data_fim: new Date().toISOString().slice(0, 10) }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador removido da escala.");
    qc.invalidateQueries({ queryKey: ["escalas"] });
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {m.colaboradores?.nome ?? "—"}
      {canEdit && <button onClick={remover} aria-label="Remover"><Trash2 className="h-3 w-3" /></button>}
    </Badge>
  );
}

function EscalaDialog({ value, postos, onClose }: { value: E; postos: { id: string; nome: string }[]; onClose: () => void }) {
  const [f, setF] = useState(value);
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { posto_id: f.posto_id, nome: f.nome.trim(), tipo: f.tipo, hora_inicio: f.hora_inicio, hora_fim: f.hora_fim, ativo: f.ativo, observacoes: f.observacoes || null };
    const { error } = f.id ? await supabase.from("escalas").update(payload).eq("id", f.id) : await supabase.from("escalas").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Escala salva.");
    qc.invalidateQueries({ queryKey: ["escalas"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{f.id ? "Editar escala" : "Nova escala"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Nome da escala *</Label><Input value={f.nome} required onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Posto *</Label>
            <Select value={f.posto_id} onValueChange={(v) => setF({ ...f, posto_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input type="time" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /><Label>Escala ativa</Label></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!f.posto_id}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ escalaId, onClose }: { escalaId: string; onClose: () => void }) {
  const [colabId, setColabId] = useState("");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();
  const { data: colabs } = useQuery({
    queryKey: ["colabs-ativos"],
    queryFn: async () => (await supabase.from("colaboradores").select("id, nome, matricula").eq("arquivado", false).eq("situacao", "ativo").order("nome")).data ?? [],
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("escala_colaboradores").insert({ escala_id: escalaId, colaborador_id: colabId, data_inicio: inicio });
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador alocado.");
    qc.invalidateQueries({ queryKey: ["escalas"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Alocar colaborador</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="space-y-1.5"><Label>Colaborador *</Label>
            <Select value={colabId} onValueChange={setColabId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{colabs?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.matricula})</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Início na escala</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!colabId}>Alocar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
