import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileWarning, Paperclip, Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { FuncaoBadge, FuncaoLegenda } from "@/components/funcao-badge";
import { useMe } from "@/lib/use-me";
import { canConfirmPresenca, canEditPresenca, PRESENCA_LABELS } from "@/lib/labels";
import { dayStatus } from "@/lib/planilha";
import { AUTO_LABELS, statusAutomatico, type AutoStatus } from "@/lib/presenca-auto";
import { anexarJustificativa, validarFaltaJustificada } from "@/lib/falta-justificada";

export const Route = createFileRoute("/_authenticated/presenca")({
  head: () => ({ meta: [
    { title: "Presença e faltas — Grupo Confidence" },
    { name: "description", content: "Presença diária pela escala, exceções manuais, justificativas e coberturas da equipe Confidence." },
    { property: "og:title", content: "Presença e faltas — Grupo Confidence" },
    { property: "og:description", content: "Presença diária pela escala, exceções manuais, justificativas e coberturas da equipe Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="presenca"><Presenca /></RequireModule>,
});

const STATUS = ["presente", "falta", "falta_justificada", "atestado", "folga", "ferias"] as const;
const TONE: Record<AutoStatus, "default" | "secondary" | "destructive" | "outline"> = {
  presente: "default", registrado: "secondary", folga: "secondary", sem_escala: "outline",
};

type ColaboradorOption = { id: string; nome: string; matricula: string; posto_id: string | null };
type PresencaRegistro = {
  id: string;
  status: string;
  justificativa: string | null;
  cobertura_colaborador_id: string | null;
  confirmado: boolean;
};

function Presenca() {
  const { data: me } = useMe();
  const canEdit = canEditPresenca(me?.roles ?? []);
  const canConfirm = canConfirmPresenca(me?.roles ?? []);
  const qc = useQueryClient();
  const [data, setData] = useState(new Date().toLocaleDateString("sv-SE"));
  const [postoId, setPostoId] = useState("all");
  const [busy, setBusy] = useState(false);
  const [justificativa, setJustificativa] = useState<{ colabId: string; postoId: string | null } | null>(null);

  useEffect(() => {
    const ch = supabase.channel("presenca-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "presencas" }, () => qc.invalidateQueries({ queryKey: ["presencas"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "posto_planilha" }, () => qc.invalidateQueries({ queryKey: ["presencas"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "documentos" }, () => qc.invalidateQueries({ queryKey: ["presencas"] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const { data: q } = useQuery({
    queryKey: ["presencas", data],
    queryFn: async () => {
      const [postosResult, colabsResult, presResult, planResult, docsResult] = await Promise.all([
        supabase.from("postos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("colaboradores").select("id, nome, matricula, posto_id, funcoes(nome)").eq("arquivado", false).eq("situacao", "ativo").order("nome"),
        supabase.from("presencas").select("*").eq("data", data),
        supabase.from("posto_planilha").select("colaborador_id,posto_id,paridade,escala_tipo,ajustes,hora_inicio,hora_fim,turno,mes").lte("mes", `${data.slice(0, 7)}-01`).eq("removido", false).order("mes", { ascending: false }),
        supabase.from("documentos").select("id, presenca_id").not("presenca_id", "is", null),
      ]);
      if (postosResult.error) throw postosResult.error;
      if (colabsResult.error) throw colabsResult.error;
      if (presResult.error) throw presResult.error;
      if (planResult.error) throw planResult.error;
      if (docsResult.error) throw docsResult.error;

      // Se o mês ainda não foi montado, repete somente o horário e a paridade da última escala.
      const mesAtual = `${data.slice(0, 7)}-01`;
      const porColab = new Map<string, NonNullable<typeof planResult.data>[number]>();
      for (const p of planResult.data ?? []) {
        if (porColab.has(p.colaborador_id)) continue;
        porColab.set(p.colaborador_id, p.mes === mesAtual ? p : { ...p, ajustes: {} });
      }
      return {
        postos: postosResult.data ?? [],
        colabs: colabsResult.data ?? [],
        pres: presResult.data ?? [],
        plan: [...porColab.values()],
        docs: docsResult.data ?? [],
      };
    },
    refetchInterval: 60_000,
  });

  const day = Number(data.slice(8, 10));
  const linhas = (q?.colabs ?? []).map((c) => {
    const plano = q?.plan?.find((p) => p.colaborador_id === c.id);
    const pres = q?.pres?.find((p) => p.colaborador_id === c.id);
    const posto = plano?.posto_id ?? c.posto_id;
    const scheduled = plano ? dayStatus(plano, day, data.slice(0, 7)) : null;
    const auto = statusAutomatico({ scheduled, manual: pres?.status });
    const documento = pres ? q?.docs?.find((d) => d.presenca_id === pres.id) : undefined;
    return { c, plano, pres, posto, scheduled, auto, documento };
  }).filter((l) => postoId === "all" || l.posto === postoId);

  const resumo = [
    { label: "Presentes pela escala", n: linhas.filter((l) => l.auto === "presente").length },
    { label: "Alterações manuais", n: linhas.filter((l) => l.auto === "registrado").length },
    { label: "Faltas e atestados", n: linhas.filter((l) => l.pres && ["falta", "falta_justificada", "atestado"].includes(l.pres.status)).length },
    { label: "Folgas pela escala", n: linhas.filter((l) => l.auto === "folga").length },
  ];

  async function setStatus(colabId: string, pPostoId: string | null, status: string) {
    if (status === "falta_justificada") {
      setJustificativa({ colabId, postoId: pPostoId });
      return;
    }
    const plano = q?.plan.find((p) => p.colaborador_id === colabId);
    const scheduled = plano ? dayStatus(plano, day, data.slice(0, 7)) : null;
    if (status === "presente" && scheduled !== "T") {
      toast.error("Este colaborador está de folga pela escala nesta data.");
      return;
    }
    const existing = q?.pres?.find((p) => p.colaborador_id === colabId);
    const payload = { colaborador_id: colabId, posto_id: pPostoId, data, status: status as (typeof STATUS)[number], registrado_por: me?.profile?.id ?? null };
    const { error } = existing
      ? await supabase.from("presencas").update({ status: payload.status, registrado_por: payload.registrado_por, justificativa: null, cobertura_colaborador_id: null }).eq("id", existing.id)
      : await supabase.from("presencas").insert(payload);
    if (error) { toast.error("Não foi possível salvar a alteração de presença."); return; }
    toast.success("Alteração manual registrada.");
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  async function setCobertura(presencaId: string, cobertura: string | null) {
    const { error } = await supabase.from("presencas").update({ cobertura_colaborador_id: cobertura }).eq("id", presencaId);
    if (error) { toast.error("Não foi possível salvar a cobertura."); return; }
    toast.success("Cobertura da falta atualizada.");
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  async function confirmar(ids: string[], valor = true) {
    if (!ids.length) return;
    setBusy(true);
    const { error } = await supabase.from("presencas").update({ confirmado: valor }).in("id", ids);
    setBusy(false);
    if (error) { toast.error(valor ? "Não foi possível confirmar. Verifique os anexos obrigatórios." : "Não foi possível retirar a confirmação."); return; }
    toast.success(valor ? "Lançamentos confirmados." : "Confirmação retirada.");
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  const naoConfirmados = linhas.filter((l) => l.pres && !(l.auto === "folga" && l.pres.status === "presente") && !l.pres.confirmado && (l.pres.status !== "falta_justificada" || l.documento)).map((l) => l.pres!.id);
  const justificativaColab = justificativa ? q?.colabs.find((c) => c.id === justificativa.colabId) : undefined;
  const justificativaPres = justificativa ? q?.pres?.find((p) => p.colaborador_id === justificativa.colabId) : undefined;

  return (
    <div>
      <PageHeader
        title="Presença e faltas"
        description="Todos os escalados começam presentes. Supervisores e gestores registram só as exceções; Administração e RH confirmam."
        actions={<span className="flex items-center gap-2 text-xs text-success"><Radio className="h-4 w-4 animate-pulse" />Tempo real</span>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="pres-data">Data</Label><Input id="pres-data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Posto</Label>
          <Select value={postoId} onValueChange={setPostoId}>
            <SelectTrigger className="w-56" aria-label="Posto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os postos</SelectItem>
              {q?.postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canConfirm && naoConfirmados.length > 0 && <Button disabled={busy} onClick={() => confirmar(naoConfirmados)}><CheckCircle2 />Confirmar todos ({naoConfirmados.length})</Button>}
      </div>
      <div className="mb-4 grid grid-cols-2 divide-x border-y py-3 lg:grid-cols-4">{resumo.map((r) => <div key={r.label} className="px-3"><p className="text-xs text-muted-foreground">{r.label}</p><p className="text-xl font-semibold">{r.n}</p></div>)}</div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><FuncaoLegenda /><p className="text-xs text-muted-foreground">Falta justificada exige anexo antes da confirmação.</p></div>
      {linhas.length === 0 ? <EmptyState text="Nenhum colaborador ativo neste posto." /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Função</TableHead><TableHead>Posto</TableHead><TableHead>Horário</TableHead><TableHead>Situação do dia</TableHead><TableHead>Alteração manual</TableHead><TableHead>Cobertura</TableHead><TableHead>Documento</TableHead><TableHead>Confirmação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {linhas.map(({ c, plano, pres, posto, scheduled, auto, documento }) => (
                <TableRow key={c.id}>
                  <TableCell><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.matricula}</p></TableCell>
                  <TableCell><FuncaoBadge nome={c.funcoes?.nome} /></TableCell>
                  <TableCell>{q?.postos.find((x) => x.id === posto)?.nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{plano ? `${plano.hora_inicio.slice(0, 5)}–${plano.hora_fim.slice(0, 5)}` : "—"}</TableCell>
                  <TableCell><Badge variant={TONE[auto]}>{auto === "registrado" && pres ? PRESENCA_LABELS[pres.status as keyof typeof PRESENCA_LABELS] : AUTO_LABELS[auto]}</Badge></TableCell>
                  <TableCell>
                    {canEdit && !(pres?.confirmado && !canConfirm) ? (
                      <Select value={auto === "folga" && pres?.status === "presente" ? "" : pres?.status ?? ""} onValueChange={(v) => setStatus(c.id, posto, v)}>
                        <SelectTrigger className="w-48" aria-label={`Alterar presença de ${c.nome}`}><SelectValue placeholder={auto === "registrado" && pres ? PRESENCA_LABELS[pres.status as keyof typeof PRESENCA_LABELS] : AUTO_LABELS[auto]} /></SelectTrigger>
                        <SelectContent>{STATUS.filter((s) => s !== "presente" || scheduled === "T").map((s) => <SelectItem key={s} value={s}>{PRESENCA_LABELS[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : pres ? PRESENCA_LABELS[pres.status as keyof typeof PRESENCA_LABELS] : AUTO_LABELS[auto]}
                  </TableCell>
                  <TableCell>
                    {pres?.status === "falta_justificada" ? (
                      canEdit && !(pres.confirmado && !canConfirm) ? (
                        <Select value={pres.cobertura_colaborador_id ?? "nenhuma"} onValueChange={(v) => setCobertura(pres.id, v === "nenhuma" ? null : v)}>
                          <SelectTrigger className="w-52" aria-label={`Cobertura de ${c.nome}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhuma">Nenhuma cobertura informada</SelectItem>
                            {(q?.colabs ?? []).filter((x) => x.id !== c.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.nome} · {x.matricula}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : <span>{q?.colabs.find((x) => x.id === pres.cobertura_colaborador_id)?.nome ?? "Não informada"}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {pres?.status === "falta_justificada" ? documento ? (
                      <Link to="/documentos" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"><Paperclip className="h-4 w-4" />Anexado</Link>
                    ) : canEdit && !(pres.confirmado && !canConfirm) ? (
                      <Button size="sm" variant="outline" onClick={() => setJustificativa({ colabId: c.id, postoId: posto })}><FileWarning />Anexar</Button>
                    ) : <Badge variant="destructive">Anexo pendente</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {!pres || (auto === "folga" && pres.status === "presente") ? <span className="text-xs text-muted-foreground">{auto === "folga" ? "Folga automática" : "Sem alteração"}</span>
                      : pres.confirmado ? <div className="flex items-center gap-2"><Badge><CheckCircle2 className="mr-1 h-3 w-3" />Confirmado</Badge>{canConfirm && <Button size="sm" variant="ghost" disabled={busy} onClick={() => confirmar([pres.id], false)}>Desfazer</Button>}</div>
                      : pres.status === "falta_justificada" && !documento ? <Badge variant="outline">Aguardando anexo</Badge>
                      : canConfirm ? <Button size="sm" variant="outline" disabled={busy} onClick={() => confirmar([pres.id])}>OK</Button>
                      : <Badge variant="outline">Aguardando confirmação</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {justificativa && justificativaColab && (
        <JustificativaDialog
          colaborador={justificativaColab}
          colaboradores={q?.colabs ?? []}
          postoId={justificativa.postoId}
          data={data}
          existing={justificativaPres ?? null}
          onClose={() => setJustificativa(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["presencas"] });
            qc.invalidateQueries({ queryKey: ["documentos"] });
          }}
        />
      )}
    </div>
  );
}

function JustificativaDialog({ colaborador, colaboradores, postoId, data, existing, onClose, onSaved }: {
  colaborador: ColaboradorOption;
  colaboradores: ColaboradorOption[];
  postoId: string | null;
  data: string;
  existing: PresencaRegistro | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: me } = useMe();
  const [motivo, setMotivo] = useState(existing?.justificativa ?? "");
  const [cobertura, setCobertura] = useState(existing?.cobertura_colaborador_id ?? "nenhuma");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const invalido = validarFaltaJustificada({ justificativa: motivo, arquivo });
    if (invalido) { toast.error(invalido); return; }
    if (cobertura === colaborador.id) { toast.error("A cobertura deve ser outro colaborador."); return; }
    setEnviando(true);
    const valores = {
      status: "falta_justificada" as const,
      justificativa: motivo.trim(),
      cobertura_colaborador_id: cobertura === "nenhuma" ? null : cobertura,
      registrado_por: me?.profile?.id ?? null,
    };
    let presencaId = existing?.id;
    if (existing) {
      const { error } = await supabase.from("presencas").update(valores).eq("id", existing.id);
      if (error) { setEnviando(false); toast.error("Não foi possível salvar a falta justificada."); return; }
    } else {
      const { data: saved, error } = await supabase.from("presencas").insert({
        colaborador_id: colaborador.id,
        posto_id: postoId,
        data,
        ...valores,
      }).select("id").single();
      if (error || !saved) { setEnviando(false); toast.error("Não foi possível salvar a falta justificada."); return; }
      presencaId = saved.id;
    }

    if (arquivo) {
      const resultado = await anexarJustificativa({
        presencaId: presencaId!,
        colaboradorId: colaborador.id,
        data,
        justificativa: motivo,
        arquivo,
      });
      setEnviando(false);
      onSaved();
      if (resultado.error) {
        toast.error(`${resultado.error} A falta ficou na lista de pendências de Documentos.`);
        return;
      }
      toast.success("Falta justificada, cobertura e documento salvos.");
    } else {
      setEnviando(false);
      onSaved();
      toast.success("Falta justificada salva. O comprovante pode ser anexado depois; a confirmação ficará pendente.");
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Falta justificada · {colaborador.nome}</DialogTitle>
          <DialogDescription>Informe o motivo, quem cobriu o plantão e anexe o comprovante. O anexo é obrigatório para a confirmação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-falta">Motivo da falta *</Label>
            <Textarea id="motivo-falta" required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva a justificativa apresentada" />
          </div>
          <div className="space-y-1.5">
            <Label>Quem cobriu a falta neste dia?</Label>
            <Select value={cobertura} onValueChange={setCobertura}>
              <SelectTrigger aria-label="Colaborador que cobriu a falta"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma cobertura informada</SelectItem>
                {colaboradores.filter((c) => c.id !== colaborador.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} · {c.matricula}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />A cobertura fica vinculada somente a esta data.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anexo-falta">Documento comprobatório * (máx. 20 MB)</Label>
            <Input id="anexo-falta" type="file" required accept=".pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={enviando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar falta e anexo"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
