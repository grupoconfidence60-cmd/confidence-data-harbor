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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditFerias, FERIAS_LABELS } from "@/lib/labels";
import { DIAS_POR_TIPO, FERIAS_TIPO_LABELS, diasTotais, fimAutomatico, type FeriasTipo } from "@/lib/ferias";

export const Route = createFileRoute("/_authenticated/ferias")({
  head: () => ({ meta: [
    { title: "Férias e abonos — Grupo Confidence" },
    { name: "description", content: "Solicitações e acompanhamento de férias e abono pecuniário da equipe Confidence." },
    { property: "og:title", content: "Férias e abonos — Grupo Confidence" },
    { property: "og:description", content: "Solicitações e acompanhamento de férias e abono pecuniário da equipe Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="ferias"><Ferias /></RequireModule>,
});

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function TipoBadge({ tipo }: { tipo: FeriasTipo }) {
  return <Badge variant={tipo === "abono" ? "secondary" : "outline"}>{tipo === "abono" ? "Abono" : "Férias"}</Badge>;
}

function Ferias() {
  const { data: me } = useMe();
  const canEdit = canEditFerias(me?.roles ?? []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedColabId, setSelectedColabId] = useState<string | null>(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["ferias"],
    queryFn: async () => {
      const [feriasResult, colabsResult] = await Promise.all([
        supabase.from("ferias").select("*").order("data_inicio", { ascending: false }),
        supabase.from("colaboradores").select("id, nome, matricula, user_id, situacao").eq("arquivado", false).order("nome"),
      ]);
      if (feriasResult.error) throw feriasResult.error;
      if (colabsResult.error) throw colabsResult.error;
      return { ferias: feriasResult.data ?? [], colabs: colabsResult.data ?? [] };
    },
  });
  const colabNome = (id: string) => data?.colabs.find((c) => c.id === id)?.nome ?? "—";
  const isColab = (me?.roles ?? []).includes("colaborador") && !canEdit;
  const meuColabId = data?.colabs.find((c) => c.user_id === me?.profile?.id)?.id;
  const todas = data?.ferias ?? [];
  const lista = isColab ? todas.filter((f) => f.colaborador_id === meuColabId) : todas;
  const soFerias = todas.filter((f) => f.tipo !== "abono");
  const abonos = todas.filter((f) => f.tipo === "abono");
  const hoje = new Date().toISOString().slice(0, 10);
  const emFerias = (data?.colabs ?? []).filter((c) => c.situacao === "ferias" || soFerias.some((f) => f.colaborador_id === c.id && (f.status === "aprovada" || f.status === "em_gozo") && f.data_inicio <= hoje && f.data_fim >= hoje))
    .map((c) => ({ ...c, periodo: soFerias.find((f) => f.colaborador_id === c.id && f.status !== "recusada" && f.data_fim >= hoje) }));

  const semPeriodo = emFerias.filter((c) => !c.periodo);

  async function setStatus(id: string, status: "aprovada" | "recusada") {
    if (!canEdit) return;
    const { error } = await supabase.from("ferias").update({ status, aprovado_por: me?.profile?.id ?? null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "aprovada" ? "Férias aprovadas." : "Solicitação recusada.");
    qc.invalidateQueries({ queryKey: ["ferias"] });
  }

  if (isPending) return <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground" role="status">Carregando férias...</div>;
  if (error) return (
    <div className="space-y-3 rounded-lg border bg-card p-6 text-center text-foreground" role="alert">
      <p>Não foi possível carregar os períodos de férias: {error.message}</p>
      <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Férias" description="Solicitações, aprovações, períodos de gozo e abono pecuniário"
        actions={<Button onClick={() => { setSelectedColabId(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Solicitar férias</Button>} />
      <Tabs defaultValue="acompanhamento" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          {!isColab && <TabsTrigger value="abonos">Abonos pecuniários ({abonos.length})</TabsTrigger>}
          {!isColab && <TabsTrigger value="sem-periodo">Períodos não informados ({semPeriodo.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="acompanhamento" className="space-y-4">
      {!isColab && (
        <Card className="mb-4"><CardContent className="p-4">
          <h2 className="mb-2 font-semibold">Em férias agora ({emFerias.length})</h2>
          {emFerias.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum colaborador em férias no momento.</p> : (
            <ul className="grid gap-1 text-sm">{emFerias.map((c) => (
              <li key={c.id} className="flex justify-between border-b py-1 last:border-0"><span className="font-medium">{c.nome} <span className="text-muted-foreground">({c.matricula})</span></span>
                <span className="text-muted-foreground">{c.periodo ? `${fmt(c.periodo.data_inicio)} — ${fmt(c.periodo.data_fim)}` : "Período não informado"}</span></li>
            ))}</ul>
          )}
        </CardContent></Card>
      )}
      {lista.length === 0 ? <EmptyState text="Nenhuma solicitação de férias." /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead>Período</TableHead><TableHead>Dias</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead className="w-24">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {lista.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{colabNome(f.colaborador_id)}</TableCell>
                  <TableCell><TipoBadge tipo={f.tipo === "abono" ? "abono" : "ferias"} /></TableCell>
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
        </TabsContent>
        {!isColab && (
          <TabsContent value="abonos" className="space-y-4">
            <p className="text-sm text-muted-foreground">Abono pecuniário: dias vendidos, com 20 dias calculados automaticamente. O colaborador continua trabalhando e a situação cadastral dele não muda.</p>
            {abonos.length === 0 ? <EmptyState text="Nenhum abono pecuniário registrado." /> : (
              <Card><CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Período</TableHead><TableHead>Dias</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead className="w-24">Ações</TableHead>}</TableRow></TableHeader>
                  <TableBody>{abonos.map((f) => (
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
                  ))}</TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>
        )}
        {!isColab && (
          <TabsContent value="sem-periodo" className="space-y-4">
            <p className="text-sm text-muted-foreground">Colaboradores exibidos em “Em férias agora” com período não informado. Informe as datas reais; a situação cadastral não será alterada.</p>
            {semPeriodo.length === 0 ? <EmptyState text="Nenhum colaborador com período não informado nesta lista." /> : (
              <Card><CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Matrícula</TableHead><TableHead>Colaborador</TableHead><TableHead>Período</TableHead>{canEdit && <TableHead>Ação</TableHead>}</TableRow></TableHeader>
                  <TableBody>{semPeriodo.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.matricula}</TableCell>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-muted-foreground">Período não informado</TableCell>
                      {canEdit && <TableCell><Button variant="outline" size="sm" onClick={() => { setSelectedColabId(c.id); setOpen(true); }}>Informar período</Button></TableCell>}
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent></Card>
            )}
            {!canEdit && <p className="text-sm text-muted-foreground">O preenchimento dos períodos está disponível para administração, gestores e RH.</p>}
          </TabsContent>
        )}
      </Tabs>
      {open && <FeriasDialog colabs={data?.colabs ?? []} fixColabId={selectedColabId ?? (isColab ? meuColabId : undefined)} informarPeriodo={selectedColabId !== null} aprovar={canEdit} meId={me?.profile?.id ?? null} onClose={() => { setOpen(false); setSelectedColabId(null); }} />}
    </div>
  );
}

function FeriasDialog({ colabs, fixColabId, informarPeriodo = false, aprovar, meId, onClose }: { colabs: { id: string; nome: string; matricula: string }[]; fixColabId?: string | undefined; informarPeriodo?: boolean; aprovar: boolean; meId: string | null; onClose: () => void }) {
  const [tipo, setTipo] = useState<FeriasTipo>("ferias");
  const [f, setF] = useState({ colaborador_id: fixColabId ?? "", data_inicio: "", data_fim: "", observacoes: "" });
  const [fimManual, setFimManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const colaborador = colabs.find((c) => c.id === f.colaborador_id);
  const dias = diasTotais(f.data_inicio, f.data_fim);
  const datasValidas = dias !== null;

  function onInicioChange(valor: string) {
    setF((prev) => ({
      ...prev,
      data_inicio: valor,
      data_fim: !fimManual ? fimAutomatico(valor, tipo) : prev.data_fim,
    }));
  }

  function onTipoChange(novo: FeriasTipo) {
    setTipo(novo);
    setF((prev) => ({ ...prev, data_fim: !fimManual ? fimAutomatico(prev.data_inicio, novo) : prev.data_fim }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (informarPeriodo && !aprovar) { toast.error("Sem permissão para informar períodos."); return; }
    if (!colaborador || !datasValidas || dias === null) {
      toast.error("Selecione o colaborador e informe datas válidas, com o fim igual ou posterior ao início.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("ferias").insert({
        colaborador_id: f.colaborador_id,
        tipo,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim,
        dias,
        observacoes: f.observacoes.trim() || null,
        ...(aprovar ? { status: "aprovada" as const, aprovado_por: meId } : {}),
      });
      if (error) throw error;
      toast.success(informarPeriodo ? "Período registrado. Situação do colaborador preservada." : tipo === "abono" ? "Abono pecuniário registrado." : "Solicitação registrada.");
      await qc.invalidateQueries({ queryKey: ["ferias"] });
      onClose();
    } catch (error) {
      toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : "Não foi possível salvar o período. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{informarPeriodo ? "Informar período de férias" : "Solicitar férias ou abono"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          {fixColabId ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
              <p className="font-medium">{colaborador?.nome}</p>
              <p className="text-muted-foreground">Matrícula: {colaborador?.matricula}</p>
            </div>
          ) : (
            <div className="space-y-1.5"><Label htmlFor="ferias-colaborador">Colaborador *</Label>
              <Select disabled={saving} value={f.colaborador_id} onValueChange={(v) => setF({ ...f, colaborador_id: v })}>
                <SelectTrigger id="ferias-colaborador"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.matricula})</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div className={informarPeriodo ? "hidden" : "space-y-1.5"}>
            <Label>Tipo *</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["ferias", "abono"] as FeriasTipo[]).map((t) => (
                <Button key={t} type="button" variant={tipo === t ? "default" : "outline"} aria-pressed={tipo === t} disabled={saving}
                  onClick={() => onTipoChange(t)} className="h-auto flex-col items-start gap-0.5 py-2 text-left">
                  <span className="font-medium">{FERIAS_TIPO_LABELS[t]}</span>
                  <span className="text-xs opacity-80">{DIAS_POR_TIPO[t]} dias automáticos</span>
                </Button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Escolhendo o tipo, a data de fim e o total de dias saem calculados sozinhos. Para um período diferente, digite a data de fim manualmente.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ferias-inicio">Início *</Label><Input id="ferias-inicio" type="date" required disabled={saving} value={f.data_inicio} onChange={(e) => onInicioChange(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ferias-fim">Fim * <span className="font-normal text-muted-foreground">(automático: {DIAS_POR_TIPO[tipo]} dias)</span></Label><Input id="ferias-fim" type="date" required disabled={saving} min={f.data_inicio || undefined} value={f.data_fim} onChange={(e) => { setFimManual(true); setF({ ...f, data_fim: e.target.value }); }} /></div>
          </div>
          {dias !== null && <p className="text-sm text-muted-foreground" role="status">Total: {dias} {dias === 1 ? "dia" : "dias"}, incluindo início e fim.{!fimManual && dias === DIAS_POR_TIPO[tipo] ? " Calculado automaticamente." : ""}</p>}
          {f.data_inicio && f.data_fim && !datasValidas && <p className="text-sm text-destructive" role="alert">Informe datas válidas; o fim não pode ser anterior ao início.</p>}
          <div className="space-y-1.5"><Label htmlFor="ferias-observacoes">Observações</Label><Textarea id="ferias-observacoes" disabled={saving} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !colaborador || !datasValidas}>{saving ? "Salvando..." : informarPeriodo ? "Salvar período" : tipo === "abono" ? "Registrar abono" : "Solicitar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
