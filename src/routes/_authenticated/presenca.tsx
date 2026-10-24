import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { FuncaoBadge, FuncaoLegenda } from "@/components/funcao-badge";
import { useMe } from "@/lib/use-me";
import { canEditPresenca, PRESENCA_LABELS } from "@/lib/labels";
import { dayStatus } from "@/lib/planilha";
import { AUTO_LABELS, statusAutomatico, type AutoStatus } from "@/lib/presenca-auto";

export const Route = createFileRoute("/_authenticated/presenca")({
  head: () => ({ meta: [
    { title: "Presença e faltas — Grupo Confidence" },
    { name: "description", content: "Presenças e faltas automáticas pela escala e pelo ponto, em tempo real." },
    { property: "og:title", content: "Presença e faltas — Grupo Confidence" },
    { property: "og:description", content: "Presenças e faltas automáticas pela escala e pelo ponto, em tempo real." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="presenca"><Presenca /></RequireModule>,
});

const STATUS = ["presente", "falta", "falta_justificada", "atestado", "folga", "ferias"] as const;
const TONE: Record<AutoStatus, "default" | "secondary" | "destructive" | "outline"> = { presente: "default", atraso: "destructive", falta: "destructive", aguardando: "outline", folga: "secondary", sem_escala: "outline", registrado: "secondary" };
const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

function Presenca() {
  const { data: me } = useMe();
  const canEdit = canEditPresenca(me?.roles ?? []);
  const qc = useQueryClient();
  const [data, setData] = useState(new Date().toLocaleDateString("sv-SE"));
  const [postoId, setPostoId] = useState("all");
  const [agora, setAgora] = useState(() => new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    const ch = supabase.channel("presenca-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "presencas" }, () => qc.invalidateQueries({ queryKey: ["presencas"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "posto_planilha" }, () => qc.invalidateQueries({ queryKey: ["presencas"] }))
      .subscribe();
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, [qc]);

  const { data: q } = useQuery({
    queryKey: ["presencas", data],
    queryFn: async () => {
      const [{ data: postos }, { data: colabs }, { data: pres }, { data: plan }] = await Promise.all([
        supabase.from("postos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("colaboradores").select("id, nome, matricula, posto_id, funcoes(nome)").eq("arquivado", false).eq("situacao", "ativo").order("nome"),
        supabase.from("presencas").select("*").eq("data", data),
        supabase.from("posto_planilha").select("colaborador_id,posto_id,paridade,escala_tipo,ajustes,hora_inicio,hora_fim,turno").eq("mes", `${data.slice(0, 7)}-01`).eq("removido", false),
      ]);
      return { postos: postos ?? [], colabs: colabs ?? [], pres: pres ?? [], plan: plan ?? [] };
    },
    refetchInterval: 60_000,
  });

  const day = Number(data.slice(8, 10));
  const linhas = (q?.colabs ?? []).map((c) => {
    const plano = q?.plan.find((p) => p.colaborador_id === c.id);
    const pres = q?.pres.find((p) => p.colaborador_id === c.id);
    const posto = plano?.posto_id ?? c.posto_id;
    const scheduled = plano ? dayStatus(plano, day, data.slice(0, 7)) : null;
    const auto = statusAutomatico({ scheduled, data, inicio: plano?.hora_inicio, entrada: pres?.hora_entrada, manual: pres?.status, agora });
    return { c, plano, pres, posto, auto };
  }).filter((l) => postoId === "all" || l.posto === postoId);
  const faltasPendentes = linhas.filter((l) => l.auto === "falta" && !l.pres);
  const resumo = (["presente", "atraso", "aguardando", "falta", "folga"] as AutoStatus[]).map((s) => ({ s, n: linhas.filter((l) => l.auto === s).length }));

  async function setStatus(colabId: string, pPostoId: string | null, status: string) {
    const existing = q?.pres.find((p) => p.colaborador_id === colabId);
    const payload = { colaborador_id: colabId, posto_id: pPostoId, data, status: status as (typeof STATUS)[number], registrado_por: me?.profile?.id ?? null };
    const { error } = existing
      ? await supabase.from("presencas").update({ status: payload.status, registrado_por: payload.registrado_por }).eq("id", existing.id)
      : await supabase.from("presencas").insert(payload);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }
  async function registrarFaltas() {
    if (!faltasPendentes.length || !window.confirm(`Registrar ${faltasPendentes.length} falta(s) de quem estava escalado e não bateu o ponto?`)) return;
    setBusy(true);
    const { error } = await supabase.from("presencas").insert(faltasPendentes.map((l) => ({ colaborador_id: l.c.id, posto_id: l.posto, data, status: "falta" as const, justificativa: "Registrada automaticamente pela escala (sem ponto)", registrado_por: me?.profile?.id ?? null })));
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Faltas registradas.");
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  return (
    <div>
      <PageHeader title="Presença e faltas" description="Automático pela planilha de escalas e pelo ponto" actions={<span className="flex items-center gap-2 text-xs text-success"><Radio className="h-4 w-4 animate-pulse" />Tempo real</span>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="pres-data">Data</Label><Input id="pres-data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Posto</Label>
          <Select value={postoId} onValueChange={setPostoId}>
            <SelectTrigger className="w-56" aria-label="Posto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os postos</SelectItem>
              {q?.postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select></div>
        {canEdit && faltasPendentes.length > 0 && <Button variant="destructive" disabled={busy} onClick={registrarFaltas}><UserX />Registrar {faltasPendentes.length} falta(s)</Button>}
      </div>
      <div className="mb-4 grid grid-cols-2 divide-x border-y py-3 sm:grid-cols-5">{resumo.map((r) => <div key={r.s} className="px-3"><p className="text-xs text-muted-foreground">{AUTO_LABELS[r.s]}</p><p className={`text-xl font-semibold ${(r.s === "falta" || r.s === "atraso") && r.n ? "text-destructive" : ""}`}>{r.n}</p></div>)}</div>
      <div className="mb-3"><FuncaoLegenda /></div>
      {linhas.length === 0 ? <EmptyState text="Nenhum colaborador ativo neste posto." /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Função</TableHead><TableHead>Posto</TableHead><TableHead>Escala</TableHead><TableHead>Situação automática</TableHead><TableHead>Ajuste manual</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {linhas.map(({ c, plano, pres, posto, auto }) => (
                <TableRow key={c.id}>
                  <TableCell><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.matricula}</p></TableCell>
                  <TableCell><FuncaoBadge nome={c.funcoes?.nome} /></TableCell>
                  <TableCell>{q?.postos.find((x) => x.id === posto)?.nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{plano ? `${plano.hora_inicio.slice(0, 5)}–${plano.hora_fim.slice(0, 5)}` : "—"}</TableCell>
                  <TableCell><Badge variant={TONE[auto]}>{auto === "registrado" && pres ? PRESENCA_LABELS[pres.status as keyof typeof PRESENCA_LABELS] : AUTO_LABELS[auto]}</Badge>{pres?.hora_entrada && <p className="mt-1 text-xs text-muted-foreground">Entrada {hm(pres.hora_entrada)}{pres.hora_saida ? ` · Saída ${hm(pres.hora_saida)}` : ""}</p>}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select value={pres?.status ?? ""} onValueChange={(v) => setStatus(c.id, posto, v)}>
                        <SelectTrigger className="w-44" aria-label={`Ajustar ${c.nome}`}><SelectValue placeholder="Ajustar…" /></SelectTrigger>
                        <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{PRESENCA_LABELS[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
