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
  head: () => ({ meta: [
    { title: "Relatórios — Grupo Confidence" },
    { name: "description", content: "Consultas e exportação de registros operacionais Confidence." },
    { property: "og:title", content: "Relatórios — Grupo Confidence" },
    { property: "og:description", content: "Consultas e exportação de registros operacionais Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="relatorios"><Relatorios /></RequireModule>,
});

type Row = Record<string, string | number | null>;

async function downloadXlsx(nome: string, rows: Row[]) {
  if (!rows.length) { toast.error("Nenhum dado para exportar."); return; }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${nome}.xlsx`);
}

function downloadCsv(nome: string, rows: Row[]) {
  const first = rows[0];
  if (!first) { toast.error("Nenhum dado para exportar."); return; }
  const cols = Object.keys(first);
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
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
        let q = supabase.from("presencas").select("id, data, status, justificativa, posto_id, hora_entrada, hora_saida, distancia_metros, latitude, longitude, registrado_por, confirmado, confirmado_por, confirmado_em, created_at, updated_at, colaboradores:colaborador_id(nome, matricula), cobertura:cobertura_colaborador_id(nome)")
          .gte("data", de).lte("data", ate).order("data", { ascending: false });
        if (postoId !== "all") q = q.eq("posto_id", postoId);
        const { data, error } = await q;
        if (error) { toast.error(error.message); return []; }
        const fmtHora = (v: string | null) => (v ? new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
        const fmtDh = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "");
        const ids = (data ?? []).map((r) => r.id);
        const pessoas = new Set<string>();
        (data ?? []).forEach((r) => { if (r.registrado_por) pessoas.add(r.registrado_por); if (r.confirmado_por) pessoas.add(r.confirmado_por); });
        const [{ data: profs }, { data: docs }] = await Promise.all([
          pessoas.size ? supabase.from("profiles").select("id, nome").in("id", [...pessoas]) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
          ids.length ? supabase.from("documentos").select("presenca_id, arquivo_nome").in("presenca_id", ids.slice(0, 500)) : Promise.resolve({ data: [] as { presenca_id: string | null; arquivo_nome: string }[] }),
        ]);
        const nomeP = (id: string | null) => profs?.find((p) => p.id === id)?.nome ?? "";
        const docDe = (id: string) => docs?.filter((d) => d.presenca_id === id).map((d) => d.arquivo_nome).join(", ") ?? "";
        return (data ?? []).map((r) => ({
          Data: r.data, Colaborador: (r.colaboradores as { nome: string } | null)?.nome ?? "", Matrícula: (r.colaboradores as { matricula: string } | null)?.matricula ?? "",
          Posto: postoNome(r.posto_id), Status: PRESENCA_LABELS[r.status],
          Entrada: fmtHora(r.hora_entrada), Saída: fmtHora(r.hora_saida),
          "Distância do posto (m)": r.distancia_metros != null ? Math.round(r.distancia_metros) : "",
          "Localização (GPS)": r.latitude != null ? `${r.latitude}, ${r.longitude}` : "",
          Justificativa: r.justificativa ?? "",
          Cobertura: (r.cobertura as { nome: string } | null)?.nome ?? "",
          "Documento anexado": docDe(r.id),
          "Registrado por": nomeP(r.registrado_por), "Registrado em": fmtDh(r.created_at),
          "Última alteração": fmtDh(r.updated_at),
          Confirmação: r.confirmado ? "Confirmado" : "Aguardando",
          "Confirmado por": nomeP(r.confirmado_por), "Confirmado em": fmtDh(r.confirmado_em),
        }));
      }
      if (tipo === "presencas_hist") {
        const { data, error } = await supabase.from("audit_log").select("created_at, acao, antes, depois, user_id")
          .eq("tabela", "presencas").gte("created_at", de + "T00:00:00").lte("created_at", ate + "T23:59:59").order("created_at", { ascending: false }).limit(5000);
        if (error) { toast.error(error.message); return []; }
        type P = { colaborador_id?: string; data?: string; status?: string; posto_id?: string; justificativa?: string; confirmado?: boolean } | null;
        const colIds = new Set<string>(); const users = new Set<string>();
        (data ?? []).forEach((r) => { const v = (r.depois ?? r.antes) as P; if (v?.colaborador_id) colIds.add(v.colaborador_id); if (r.user_id) users.add(r.user_id); });
        const [{ data: cols }, { data: profs }] = await Promise.all([
          colIds.size ? supabase.from("colaboradores").select("id, nome, matricula").in("id", [...colIds]) : Promise.resolve({ data: [] as { id: string; nome: string; matricula: string }[] }),
          users.size ? supabase.from("profiles").select("id, nome").in("id", [...users]) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        ]);
        const acoes: Record<string, string> = { INSERT: "Lançamento", UPDATE: "Alteração", DELETE: "Exclusão" };
        const st = (v: P) => (v?.status ? PRESENCA_LABELS[v.status as keyof typeof PRESENCA_LABELS] ?? v.status : "");
        return (data ?? []).filter((r) => {
          const v = ((r.depois ?? r.antes) as P);
          return postoId === "all" || v?.posto_id === postoId;
        }).map((r) => {
          const a = r.antes as P; const d = r.depois as P; const v = d ?? a;
          const c = cols?.find((x) => x.id === v?.colaborador_id);
          return {
            "Data/hora do registro": new Date(r.created_at).toLocaleString("pt-BR"),
            Ação: acoes[r.acao] ?? r.acao,
            "Dia da presença": v?.data ?? "", Colaborador: c?.nome ?? "", Matrícula: c?.matricula ?? "",
            Posto: postoNome(v?.posto_id ?? null),
            "Status antes": st(a), "Status depois": st(d),
            Confirmação: d ? (d.confirmado ? "Confirmado" : "Aguardando") : "",
            Justificativa: v?.justificativa ?? "",
            "Feito por": profs?.find((p) => p.id === r.user_id)?.nome ?? "",
          };
        });
      }
      if (tipo === "presencas_resumo") {
        let q = supabase.from("presencas").select("status, colaborador_id, colaboradores:colaborador_id(nome, matricula)").gte("data", de).lte("data", ate);
        if (postoId !== "all") q = q.eq("posto_id", postoId);
        const { data, error } = await q;
        if (error) { toast.error(error.message); return []; }
        const m = new Map<string, Row>();
        (data ?? []).forEach((r) => {
          const c = r.colaboradores as { nome: string; matricula: string } | null;
          const row = m.get(r.colaborador_id) ?? { Colaborador: c?.nome ?? "", Matrícula: c?.matricula ?? "", ...Object.fromEntries(Object.values(PRESENCA_LABELS).map((l) => [l, 0])), Total: 0 };
          const l = PRESENCA_LABELS[r.status];
          row[l] = Number(row[l] ?? 0) + 1; row.Total = Number(row.Total) + 1;
          m.set(r.colaborador_id, row);
        });
        return [...m.values()].sort((a, b) => String(a.Colaborador).localeCompare(String(b.Colaborador)));
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
  const previewCols = preview[0] ? Object.keys(preview[0]) : [];

  return (
    <div>
      <PageHeader title="Relatórios" description="Consulte períodos e exporte planilhas mensais em Excel ou CSV"
        actions={<div className="flex gap-2">
          <Button onClick={() => downloadXlsx(`relatorio-${tipo}-${de}-a-${ate}`, rows ?? [])} disabled={!rows?.length}><Download className="mr-1 h-4 w-4" />Exportar Excel</Button>
          <Button variant="outline" onClick={() => downloadCsv(`relatorio-${tipo}-${de}-a-${ate}`, rows ?? [])} disabled={!rows?.length}>CSV</Button>
        </div>} />
      <Card className="mb-4"><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5"><Label>Relatório</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presencas">Presenças e faltas (registros)</SelectItem>
              <SelectItem value="presencas_resumo">Presenças e faltas (resumo por colaborador)</SelectItem>
              <SelectItem value="presencas_hist">Presenças e faltas (histórico de alterações)</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="ocorrencias">Ocorrências</SelectItem>
            </SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label>Período</Label>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => { setDe(hoje()); setAte(hoje()); }}>Hoje</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setDe(d.toISOString().slice(0, 10)); setAte(hoje()); }}>7 dias</Button>
            <Button size="sm" variant="outline" onClick={() => { setDe(inicioMes()); setAte(hoje()); }}>Mês</Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); setDe(`${d.getFullYear()}-01-01`); setAte(hoje()); }}>Ano</Button>
          </div></div>
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
              <TableHeader><TableRow>{previewCols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {preview.map((r, i) => (
                  <TableRow key={i}>{previewCols.map((c, j) => <TableCell key={j}>{r[c] ?? "—"}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
