import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditPresenca, PRESENCA_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/presenca")({
  head: () => ({ meta: [{ title: "Presença e faltas — Grupo Confidence" }] }),
  component: () => <RequireModule module="presenca"><Presenca /></RequireModule>,
});

const STATUS = ["presente", "falta", "falta_justificada", "atestado", "folga", "ferias"] as const;

function Presenca() {
  const { data: me } = useMe();
  const canEdit = canEditPresenca(me?.roles ?? []);
  const qc = useQueryClient();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [postoId, setPostoId] = useState("all");

  const { data: q } = useQuery({
    queryKey: ["presencas", data, postoId],
    queryFn: async () => {
      const [{ data: postos }, { data: colabs }, { data: pres }] = await Promise.all([
        supabase.from("postos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("colaboradores").select("id, nome, matricula, posto_id").eq("arquivado", false).eq("situacao", "ativo").order("nome"),
        supabase.from("presencas").select("*").eq("data", data),
      ]);
      return { postos: postos ?? [], colabs: colabs ?? [], pres: pres ?? [] };
    },
  });

  const colabs = (q?.colabs ?? []).filter((c) => postoId === "all" || c.posto_id === postoId);
  const presOf = (cid: string) => q?.pres.find((p) => p.colaborador_id === cid);

  async function setStatus(colabId: string, pPostoId: string | null, status: string) {
    const existing = presOf(colabId);
    const payload = { colaborador_id: colabId, posto_id: pPostoId, data, status: status as (typeof STATUS)[number], registrado_por: me?.profile?.id ?? null };
    const { error } = existing
      ? await supabase.from("presencas").update({ status: payload.status, registrado_por: payload.registrado_por }).eq("id", existing.id)
      : await supabase.from("presencas").insert(payload);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  const resumo = STATUS.map((s) => ({ s, n: (q?.pres ?? []).filter((p) => p.status === s).length }));

  return (
    <div>
      <PageHeader title="Presença e faltas" description="Registro diário por colaborador" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Posto</Label>
          <Select value={postoId} onValueChange={setPostoId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os postos</SelectItem>
              {q?.postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <div className="flex gap-3 text-sm text-muted-foreground">
          {resumo.filter((r) => r.n > 0).map((r) => <span key={r.s}>{PRESENCA_LABELS[r.s]}: <b>{r.n}</b></span>)}
        </div>
      </div>
      {colabs.length === 0 ? <EmptyState text="Nenhum colaborador ativo neste posto." /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Matrícula</TableHead><TableHead>Posto</TableHead><TableHead>Status do dia</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {colabs.map((c) => {
                const p = presOf(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.matricula}</TableCell>
                    <TableCell>{q?.postos.find((x) => x.id === c.posto_id)?.nome ?? "—"}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select value={p?.status ?? ""} onValueChange={(v) => setStatus(c.id, c.posto_id, v)}>
                          <SelectTrigger className="w-48"><SelectValue placeholder="Registrar…" /></SelectTrigger>
                          <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{PRESENCA_LABELS[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (p ? PRESENCA_LABELS[p.status as keyof typeof PRESENCA_LABELS] : "—")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
