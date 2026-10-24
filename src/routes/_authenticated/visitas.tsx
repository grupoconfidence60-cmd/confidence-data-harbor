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
import { canCreateVisitas } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/visitas")({
  head: () => ({ meta: [{ title: "Visitas de supervisão — Grupo Confidence" }] }),
  component: () => <RequireModule module="visitas"><Visitas /></RequireModule>,
});

function Visitas() {
  const { data: me } = useMe();
  const canCreate = canCreateVisitas(me?.roles ?? []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const { data } = useQuery({
    queryKey: ["visitas"],
    queryFn: async () => {
      const [{ data: vis }, { data: postos }, { data: profs }] = await Promise.all([
        supabase.from("visitas").select("*").order("data_visita", { ascending: false }),
        supabase.from("postos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("profiles").select("id, nome"),
      ]);
      return { vis: vis ?? [], postos: postos ?? [], profs: profs ?? [] };
    },
  });
  const lista = (data?.vis ?? []).filter((v) =>
    filtro === "pendentes" ? v.pendencias && !v.pendencia_resolvida : filtro === "irregularidades" ? !!v.irregularidades : true,
  );
  const nomePosto = (id: string) => data?.postos.find((p) => p.id === id)?.nome ?? "—";

  async function resolverPendencia(id: string) {
    const { error } = await supabase.from("visitas").update({ pendencia_resolvida: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pendência resolvida.");
    qc.invalidateQueries({ queryKey: ["visitas"] });
  }

  return (
    <div>
      <PageHeader title="Visitas de supervisão" description="Relatórios de visita aos postos, preenchidos em campo"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nova visita</Button>} />
      <div className="mb-4">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendentes">Com pendências abertas</SelectItem>
            <SelectItem value="irregularidades">Com irregularidades</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {lista.length === 0 ? <EmptyState text="Nenhuma visita registrada." /> : (
        <div className="grid gap-3">
          {lista.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{nomePosto(v.posto_id)}</span>
                  <Badge variant="outline">{new Date(v.data_visita).toLocaleString("pt-BR")}</Badge>
                  {v.irregularidades && <Badge variant="destructive">Irregularidade</Badge>}
                  {v.pendencias && (v.pendencia_resolvida ? <Badge variant="secondary">Pendência resolvida</Badge> : <Badge>Pendência aberta</Badge>)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Supervisor: {data?.profs.find((p) => p.id === v.supervisor_id)?.nome ?? "—"}
                  {v.efetivo_encontrado != null && ` · Efetivo encontrado: ${v.efetivo_encontrado}`}
                </div>
                <div className="mt-2 grid gap-1 text-sm">
                  {v.situacao_posto && <p><b>Situação do posto:</b> {v.situacao_posto}</p>}
                  {v.uniformizacao && <p><b>Uniformização:</b> {v.uniformizacao}</p>}
                  {v.equipamentos && <p><b>Equipamentos:</b> {v.equipamentos}</p>}
                  {v.procedimentos && <p><b>Procedimentos:</b> {v.procedimentos}</p>}
                  {v.irregularidades && <p><b>Irregularidades:</b> {v.irregularidades}</p>}
                  {v.providencias && <p><b>Providências:</b> {v.providencias}</p>}
                  {v.pendencias && (
                    <p><b>Pendências:</b> {v.pendencias}
                      {v.pendencia_responsavel && ` (responsável: ${v.pendencia_responsavel}`}
                      {v.pendencia_prazo && `${v.pendencia_responsavel ? ", " : " ("}prazo: ${new Date(v.pendencia_prazo + "T12:00:00").toLocaleDateString("pt-BR")})`}
                    </p>
                  )}
                </div>
                {v.pendencias && !v.pendencia_resolvida && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => resolverPendencia(v.id)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Marcar pendência como resolvida
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && <VisitaDialog postos={data?.postos ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function VisitaDialog({ postos, onClose }: { postos: { id: string; nome: string }[]; onClose: () => void }) {
  const [f, setF] = useState({
    posto_id: "", efetivo_encontrado: "", situacao_posto: "", uniformizacao: "", equipamentos: "",
    procedimentos: "", irregularidades: "", providencias: "", pendencias: "", pendencia_responsavel: "", pendencia_prazo: "",
  });
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("visitas").insert({
      posto_id: f.posto_id, supervisor_id: userData.user!.id,
      efetivo_encontrado: f.efetivo_encontrado ? Number(f.efetivo_encontrado) : null,
      situacao_posto: f.situacao_posto || null, uniformizacao: f.uniformizacao || null,
      equipamentos: f.equipamentos || null, procedimentos: f.procedimentos || null,
      irregularidades: f.irregularidades || null, providencias: f.providencias || null,
      pendencias: f.pendencias || null, pendencia_responsavel: f.pendencia_responsavel || null,
      pendencia_prazo: f.pendencia_prazo || null,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Visita registrada.");
    qc.invalidateQueries({ queryKey: ["visitas"] });
    onClose();
  }

  const txt = (k: keyof typeof f, label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label><Textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Relatório de visita</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div className="space-y-1.5"><Label>Posto visitado *</Label>
            <Select value={f.posto_id} onValueChange={(v) => setF({ ...f, posto_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Efetivo encontrado</Label>
            <Input type="number" min={0} value={f.efetivo_encontrado} onChange={(e) => setF({ ...f, efetivo_encontrado: e.target.value })} /></div>
          {txt("situacao_posto", "Situação do posto e posições de serviço")}
          {txt("uniformizacao", "Uniformização e apresentação da equipe")}
          {txt("equipamentos", "Equipamentos e materiais")}
          {txt("procedimentos", "Procedimentos operacionais")}
          {txt("irregularidades", "Irregularidades identificadas")}
          {txt("providencias", "Providências adotadas")}
          {txt("pendencias", "Pendências")}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Responsável pela pendência</Label>
              <Input value={f.pendencia_responsavel} onChange={(e) => setF({ ...f, pendencia_responsavel: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Prazo de resolução</Label>
              <Input type="date" value={f.pendencia_prazo} onChange={(e) => setF({ ...f, pendencia_prazo: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !f.posto_id}>{enviando ? "Enviando…" : "Registrar visita"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
