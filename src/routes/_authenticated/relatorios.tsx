import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { PRESENCA_LABELS, FERIAS_LABELS, GRAVIDADE_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Grupo Confidence" }] }),
  component: () => <RequireModule module="relatorios"><Relatorios /></RequireModule>,
});

type Row = Record<string, string | number | null>;

function downloadCsv(nome: string, rows: Row[]) {
  if (rows.length === 0) { toast.error("Nenhum dado para exportar."); return; }
  const cols = Object.keys(rows[0]);
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => hoje().slice(0, 8) + "01";

function Relatorios() {
  const [tipo, setTipo] = useState("presencas");
  const [de, setDe] = useState(inicioMes());
  const [ate, setAte] = useState(hoje());
  const [postoId, setPostoId] = useState("all");

  const { data: postos } = useQuery({
    queryKey: ["postos-lista"],
    queryFn: async () => (await supabase.from("postos").select("id, nome").order("nome")).data ?? [],
  });

  const { data: rows, refetch, isFetching } = useQuery({
    queryKey: ["relatorio", tipo, de, ate, postoId],
    queryFn: async (): Promise<Row[]> => {
      const postoNome = (id: string | null) => postos?.find((p) => p.id === id)?.nome ?? "";
      if (tipo === "presencas") {
        let q = supabase.from("presencas").select("data, status, justificativa, posto_id, colaboradores:colaborador_id(nome, matricula)")
          .gte("data", de).lte("data", ate).order("data", { ascending: false });
        if (postoId !== "all") q = q.eq("posto_id", postoId);
        const { data, error } = await q;
        if (error) { toast.error(error.message); return []; }
        return (data ?? []).map((r) => ({
          Data: r.data, Colaborador: (r.colaboradores as { nome: string } | null)?.nome ?? "", Matrícula: (r.colaboradores as { matricula: string } | null)?.matricula ?? "",
          Posto: postoNome(r.posto_id), Status: PRESENCA_LABELS[r.status], Justificativa: r.justificativa ?? "",
        }));
      }
      if (tipo === "ferias") {
        const { data, error } = await supabase.from("ferias").select("data_inicio, data_fim, dias, status, colaboradores:colaborador_id(nome, matricula)")
          .gte("data_inicio", de).lte("data_inicio", ate).order("data_inicio", { ascending: false });
        if (error) { toast.error(error.message); return []; }
        return (data ?? []).map((r) => ({
          Colaborador: (r.colaboradores as { nome: string } | null)?.nome ?? "", Matrícula: (r.colaboradores as { matricula: string } | null)?.matricula ?? "",
          Início: r.data_inicio, Fim: r.data_fim, Dias: r.dias, Status: FERIAS_LABELS[r.status],
        }));
      }
      // ocorrencias
      let q = supabase.from("ocorrencias").select("data_ocorrencia, tipo, titulo, gravidade, resolvida, posto_id, colaboradores:colaborador_id(nome)")
        .gte("data_ocorrencia", de + "T00:00:00").lte("data_ocorrencia", ate + "T23:59:59").order("data_ocorrencia", { ascending: false });
      if (postoId !== "all") q = q.eq("posto_id", postoId);
      const { data, error } = await q;
      if (error) { toast.error(error.message); return []; }
      return (data ?? []).map((r) => ({
        Data: new Date(r.data_ocorrencia).toLocaleString("pt-BR"), Tipo: r.tipo, Título: r.titulo,
        Gravidade: GRAVIDADE_LABELS[r.gravidade], Posto: postoNome(r.posto_id),
        Colaborador: (r.colaboradores as { nome: string } | null)?.nome ?? "", Situação: r.resolvida ? "Resolvida" : "Em aberto",
      }));
    },
  });

  const preview = (rows ?? []).slice(0, 50);

  return (
    <div>
      <PageHeader title="Relatórios" description="Consulte períodos e exporte os dados em CSV (abre no Excel)"
        actions={<Button onClick={() => downloadCsv(`relatorio-${tipo}-${de}-a-${ate}`, rows ?? [])} disabled={!rows?.length}><Download className="mr-1 h-4 w-4" />Exportar CSV</Button>} />
      <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5"><Label>Relatório</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presencas">Presenças e faltas</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="ocorrencias">Ocorrências</SelectItem>
            </SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        {tipo !== "ferias" && (
          <div className="space-y-1.5"><Label>Posto</Label>
            <Select value={postoId} onValueChange={setPostoId}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {postos?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select></div>
        )}
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Carregando…" : "Atualizar"}</Button>
      </CardContent></Card>
      {preview.length === 0 ? <EmptyState text="Nenhum registro no período selecionado." /> : (
        <Card>
          <CardHeader><CardTitle className="text-base">{rows!.length} registro(s) — prévia dos primeiros {preview.length}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>{Object.keys(preview[0]).map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {preview.map((r, i) => (
                  <TableRow key={i}>{Object.values(r).map((v, j) => <TableCell key={j}>{v ?? "—"}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
