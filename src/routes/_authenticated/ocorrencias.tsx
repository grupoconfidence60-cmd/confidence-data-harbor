import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditOcorrencias, canCreateOcorrencias, GRAVIDADE_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({ meta: [{ title: "Ocorrências — Grupo Confidence" }] }),
  component: () => <RequireModule module="ocorrencias"><Ocorrencias /></RequireModule>,
});

const TIPOS = ["Segurança", "Disciplinar", "Operacional", "Cliente", "Equipamento", "Outro"];

type O = { posto_id: string; colaborador_id: string; tipo: string; titulo: string; descricao: string; gravidade: string; data_ocorrencia: string };
const EMPTY: O = { posto_id: "", colaborador_id: "", tipo: "Operacional", titulo: "", descricao: "", gravidade: "leve", data_ocorrencia: new Date().toISOString().slice(0, 16) };

function Ocorrencias() {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const canEdit = canEditOcorrencias(roles);
  const canCreate = canCreateOcorrencias(roles);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("abertas");
  const { data } = useQuery({
    queryKey: ["ocorrencias"],
    queryFn: async () => {
      const [{ data: oc }, { data: postos }, { data: colabs }] = await Promise.all([
        supabase.from("ocorrencias").select("*").order("data_ocorrencia", { ascending: false }),
        supabase.from("postos").select("id, nome").order("nome"),
        supabase.from("colaboradores").select("id, nome").eq("arquivado", false).order("nome"),
      ]);
      return { oc: oc ?? [], postos: postos ?? [], colabs: colabs ?? [] };
    },
  });
  const lista = (data?.oc ?? []).filter((o) => (filtro === "abertas" ? !o.resolvida : filtro === "resolvidas" ? o.resolvida : true));
  const nome = (list: { id: string; nome: string }[], id: string | null) => list.find((x) => x.id === id)?.nome ?? "—";

  async function resolver(id: string) {
    const resolucao = window.prompt("Descreva a resolução:");
    if (resolucao === null) return;
    const { error } = await supabase.from("ocorrencias").update({ resolvida: true, resolucao: resolucao || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ocorrência resolvida.");
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  return (
    <div>
      <PageHeader title="Ocorrências" description="Registro e acompanhamento de ocorrências nos postos"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nova ocorrência</Button>} />
      <div className="mb-4">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="resolvidas">Resolvidas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {lista.length === 0 ? <EmptyState text="Nenhuma ocorrência encontrada." /> : (
        <div className="grid gap-3">
          {lista.map((o) => (
            <Card key={o.id} className={o.resolvida ? "opacity-70" : ""}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.titulo}</span>
                    <Badge variant={o.gravidade === "grave" ? "destructive" : o.gravidade === "moderada" ? "default" : "secondary"}>{GRAVIDADE_LABELS[o.gravidade]}</Badge>
                    <Badge variant="outline">{o.tipo}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {nome(data?.postos ?? [], o.posto_id)} · {nome(data?.colabs ?? [], o.colaborador_id)} · {new Date(o.data_ocorrencia).toLocaleString("pt-BR")}
                  </div>
                  {o.descricao && <p className="mt-2 text-sm">{o.descricao}</p>}
                  {o.resolvida && o.resolucao && <p className="mt-2 text-sm text-muted-foreground">Resolução: {o.resolucao}</p>}
                </div>
                {canEdit && !o.resolvida && (
                  <Button size="sm" variant="outline" onClick={() => resolver(o.id)}><CheckCircle2 className="mr-1 h-4 w-4" />Resolver</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && <OcorrenciaDialog postos={data?.postos ?? []} colabs={data?.colabs ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function OcorrenciaDialog({ postos, colabs, onClose }: { postos: { id: string; nome: string }[]; colabs: { id: string; nome: string }[]; onClose: () => void }) {
  const [f, setF] = useState(EMPTY);
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("ocorrencias").insert({
      posto_id: f.posto_id || null, colaborador_id: f.colaborador_id || null, tipo: f.tipo, titulo: f.titulo.trim(),
      descricao: f.descricao || null, gravidade: f.gravidade as "leve" | "moderada" | "grave",
      data_ocorrencia: new Date(f.data_ocorrencia).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ocorrência registrada.");
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nova ocorrência</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Título *</Label><Input required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Gravidade</Label>
            <Select value={f.gravidade} onValueChange={(v) => setF({ ...f, gravidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(GRAVIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Posto</Label>
            <Select value={f.posto_id || "none"} onValueChange={(v) => setF({ ...f, posto_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Não se aplica</SelectItem>{postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Colaborador envolvido</Label>
            <Select value={f.colaborador_id || "none"} onValueChange={(v) => setF({ ...f, colaborador_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Não se aplica</SelectItem>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Data e hora</Label><Input type="datetime-local" value={f.data_ocorrencia} onChange={(e) => setF({ ...f, data_ocorrencia: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Textarea value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Registrar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
