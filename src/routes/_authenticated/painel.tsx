import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, MapPin, Plane, AlertTriangle, ClipboardCheck, Palmtree } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel — Grupo Confidence" }] }),
  component: Painel,
});

function Painel() {
  const { data: me } = useMe();
  const { data } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const [{ data: colabs }, { data: postos }, { data: presHoje }, { data: ocAbertas }, { data: feriasPend }] = await Promise.all([
        supabase.from("colaboradores").select("id,situacao,posto_id,arquivado").eq("arquivado", false),
        supabase.from("postos").select("id,nome,efetivo_previsto,ativo,supervisor_id").eq("ativo", true),
        supabase.from("presencas").select("id,status").eq("data", hoje),
        supabase.from("ocorrencias").select("id,gravidade").eq("resolvida", false),
        supabase.from("ferias").select("id").eq("status", "solicitada"),
      ]);
      return { colabs: colabs ?? [], postos: postos ?? [], presHoje: presHoje ?? [], ocAbertas: ocAbertas ?? [], feriasPend: feriasPend ?? [] };
    },
  });

  const colabs = data?.colabs ?? [];
  const postos = data?.postos ?? [];
  const ativos = colabs.filter((c) => c.situacao === "ativo");
  const porPosto = postos.map((p) => ({
    nome: p.nome.length > 14 ? p.nome.slice(0, 14) + "…" : p.nome,
    alocados: ativos.filter((c) => c.posto_id === p.id).length,
    previsto: p.efetivo_previsto,
  }));
  const deficit = postos.filter((p) => ativos.filter((c) => c.posto_id === p.id).length < p.efetivo_previsto);
  const semPosto = ativos.filter((c) => !c.posto_id).length;
  const faltasHoje = (data?.presHoje ?? []).filter((p) => p.status === "falta" || p.status === "falta_justificada").length;
  const presentesHoje = (data?.presHoje ?? []).filter((p) => p.status === "presente").length;
  const ocAbertas = data?.ocAbertas ?? [];
  const feriasPend = data?.feriasPend ?? [];

  const kpis = [
    { label: "Colaboradores ativos", value: ativos.length, icon: Users },
    { label: "Postos ativos", value: postos.length, icon: MapPin },
    { label: "Presentes hoje", value: presentesHoje, icon: ClipboardCheck },
    { label: "Faltas hoje", value: faltasHoje, icon: AlertTriangle, alert: faltasHoje > 0 },
    { label: "Em férias / afastados", value: colabs.filter((c) => c.situacao === "ferias" || c.situacao === "afastado").length, icon: Plane },
    { label: "Ocorrências abertas", value: ocAbertas.length, icon: AlertTriangle, alert: ocAbertas.some((o) => o.gravidade === "grave") },
    { label: "Férias pendentes", value: feriasPend.length, icon: Palmtree, alert: feriasPend.length > 0 },
    { label: "Postos com déficit", value: deficit.length, icon: AlertTriangle, alert: deficit.length > 0 },
  ];

  return (
    <div>
      <PageHeader title={`Olá, ${me?.profile?.nome?.split(" ")[0] ?? ""}`} description="Visão geral da operação, atualizada em tempo real com os dados cadastrados." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alert ? "border-warning" : ""}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-sm text-muted-foreground">{k.label}</div>
                <div className="mt-1 font-display text-3xl font-semibold">{k.value}</div>
              </div>
              <k.icon className={k.alert ? "h-6 w-6 text-warning" : "h-6 w-6 text-brand-accent"} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Efetivo por posto (alocado × previsto)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {porPosto.length === 0 ? (
              <EmptyState text="Cadastre postos para ver o gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porPosto}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="alocados" name="Alocados" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previsto" name="Previsto" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Pendências</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {feriasPend.length > 0 && (
              <Link to="/ferias" className="flex items-start gap-2 rounded-md bg-muted p-3">
                <Palmtree className="mt-0.5 h-4 w-4" /> <span>{feriasPend.length} solicitação(ões) de férias aguardando aprovação.</span>
              </Link>
            )}
            {ocAbertas.length > 0 && (
              <Link to="/ocorrencias" className="flex items-start gap-2 rounded-md bg-muted p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4" /> <span>{ocAbertas.length} ocorrência(s) em aberto{ocAbertas.some((o) => o.gravidade === "grave") ? ", incluindo grave(s)" : ""}.</span>
              </Link>
            )}
            {deficit.map((p) => (
              <div key={p.id} className="flex items-start gap-2 rounded-md bg-warning/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                <span>Posto <b>{p.nome}</b> abaixo do efetivo previsto.</span>
              </div>
            ))}
            {semPosto > 0 && (
              <Link to="/colaboradores" className="flex items-start gap-2 rounded-md bg-muted p-3">
                <Users className="mt-0.5 h-4 w-4" /> <span>{semPosto} colaborador(es) ativo(s) sem posto.</span>
              </Link>
            )}
            {deficit.length === 0 && semPosto === 0 && feriasPend.length === 0 && ocAbertas.length === 0 && <p className="text-muted-foreground">Nenhuma pendência no momento.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
