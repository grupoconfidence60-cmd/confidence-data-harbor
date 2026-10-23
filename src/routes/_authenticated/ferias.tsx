import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, X } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditFerias, FERIAS_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/ferias")({
  head: () => ({ meta: [{ title: "Férias — Grupo Confidence" }] }),
  component: () => <RequireModule module="ferias"><Ferias /></RequireModule>,
});

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function Ferias() {
  const { data: me } = useMe();
  const canEdit = canEditFerias(me?.roles ?? []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["ferias"],
    queryFn: async () => {
      const [{ data: ferias }, { data: colabs }] = await Promise.all([
        supabase.from("ferias").select("*").order("data_inicio", { ascending: false }),
        supabase.from("colaboradores").select("id, nome, matricula, user_id").eq("arquivado", false).order("nome"),
      ]);
      return { ferias: ferias ?? [], colabs: colabs ?? [] };
    },
  });
  const colabNome = (id: string) => data?.colabs.find((c) => c.id === id)?.nome ?? "—";
  const isColab = (me?.roles ?? []).includes("colaborador") && !canEdit;
  const meuColabId = data?.colabs.find((c) => c.user_id === me?.profile?.id)?.id;
  const lista = isColab ? (data?.ferias ?? []).filter((f) => f.colaborador_id === meuColabId) : (data?.ferias ?? []);

  async function setStatus(id: string, status: "aprovada" | "recusada") {
    const { error } = await supabase.from("ferias").update({ status, aprovado_por: me?.profile?.id }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "aprovada" ? "Férias aprovadas." : "Solicitação recusada.");
    qc.invalidateQueries({ queryKey: ["ferias"] });
  }

  return (
    <div>
      <PageHeader title="Férias" description="Solicitações, aprovações e períodos de gozo"
        actions={<Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Solicitar férias</Button>} />
      {lista.length === 0 ? <EmptyState text="Nenhuma solicitação de férias." /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Período</TableHead><TableHead>Dias</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead className="w-24">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {lista.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{colabNome(f.colaborador_id)}</TableCell>
                  <TableCell>{fmt(f.data_inicio)} — {fmt(f.data_fim)}</TableCell>
                  <TableCell>{f.dias}</TableCell>
                  <TableCell><Badge variant={f.status === "aprovada" || f.status === "em_gozo" ? "default" : f.status === "recusada" ? "destructive" : "secondary"}>{FERIAS_LABELS[f.status]}</Badge></TableCell>
                  {canEdit && (
                    <TableCell>
                      {f.status === "solicitada" && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" title="Aprovar" onClick={() => setStatus(f.id, "aprovada")}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Recusar" onClick={() => setStatus(f.id, "recusada")}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {open && <FeriasDialog colabs={data?.colabs ?? []} fixColabId={isColab ? meuColabId : undefined} onClose={() => setOpen(false)} />}
    </div>
  );
}

function FeriasDialog({ colabs, fixColabId, onClose }: { colabs: { id: string; nome: string; matricula: string }[]; fixColabId?: string; onClose: () => void }) {
  const [f, setF] = useState({ colaborador_id: fixColabId ?? "", data_inicio: "", dias: 30, observacoes: "" });
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ini = new Date(f.data_inicio + "T00:00:00");
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + Number(f.dias) - 1);
    const { error } = await supabase.from("ferias").insert({
      colaborador_id: f.colaborador_id, data_inicio: f.data_inicio,
      data_fim: fim.toISOString().slice(0, 10), dias: Number(f.dias), observacoes: f.observacoes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação registrada.");
    qc.invalidateQueries({ queryKey: ["ferias"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar férias</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          {!fixColabId && (
            <div className="space-y-1.5"><Label>Colaborador *</Label>
              <Select value={f.colaborador_id} onValueChange={(v) => setF({ ...f, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.matricula})</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início *</Label><Input type="date" required value={f.data_inicio} onChange={(e) => setF({ ...f, data_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Dias *</Label><Input type="number" min={1} max={30} required value={f.dias} onChange={(e) => setF({ ...f, dias: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!f.colaborador_id || !f.data_inicio}>Solicitar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
