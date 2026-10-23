import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule } from "@/components/page";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Grupo Confidence" }] }),
  component: () => <RequireModule module="auditoria"><Auditoria /></RequireModule>,
});

const TABELAS: Record<string, string> = { colaboradores: "Colaboradores", postos: "Postos", funcoes: "Funções", profiles: "Usuários", user_roles: "Perfis de acesso" };
const ACOES: Record<string, string> = { INSERT: "Criou", UPDATE: "Alterou", DELETE: "Excluiu" };

function Auditoria() {
  const [tabela, setTabela] = useState("todas");
  const { data } = useQuery({
    queryKey: ["audit", tabela],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      const [{ data: logs }, { data: profiles }] = await Promise.all([q, supabase.from("profiles").select("id,nome")]);
      return { logs: logs ?? [], profiles: profiles ?? [] };
    },
  });
  const nome = (id: string | null) => (id ? data?.profiles.find((p) => p.id === id)?.nome ?? "—" : "Sistema");
  const label = (l: { depois: unknown; antes: unknown }) => {
    const o = (l.depois ?? l.antes) as Record<string, unknown> | null;
    return (o?.["nome"] as string) ?? (o?.["role"] as string) ?? (o?.["matricula"] as string) ?? "";
  };
  return (
    <div>
      <PageHeader title="Auditoria" description="Últimos 200 registros de ações no sistema"
        actions={<Select value={tabela} onValueChange={setTabela}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todas">Todos os módulos</SelectItem>{Object.entries(TABELAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Módulo</TableHead><TableHead>Registro</TableHead></TableRow></TableHeader>
          <TableBody>{data?.logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-sm">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell>{nome(l.user_id)}</TableCell>
              <TableCell><Badge variant={l.acao === "DELETE" ? "destructive" : "secondary"}>{ACOES[l.acao] ?? l.acao}</Badge></TableCell>
              <TableCell>{TABELAS[l.tabela] ?? l.tabela}</TableCell>
              <TableCell className="text-sm">{label(l)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}
