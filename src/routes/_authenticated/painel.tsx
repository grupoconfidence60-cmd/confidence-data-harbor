import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, MapPin, Plane, AlertTriangle, ClipboardCheck, Palmtree, FileText, ClipboardList, ArrowUpRight, RefreshCw, ArrowRight, CheckCircle2, CalendarDays } from "lucide-react";
import { Bar, BarChart, Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, RequireModule } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccess } from "@/lib/labels";
import { useMe } from "@/lib/use-me";
import { PostosComparativo } from "@/components/postos-comparativo";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [
    { title: "Painel — Grupo Confidence" },
    { name: "description", content: "Indicadores e acompanhamento da operação do Grupo Confidence." },
    { property: "og:title", content: "Painel — Grupo Confidence" },
    { property: "og:description", content: "Indicadores e acompanhamento da operação do Grupo Confidence." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="painel"><Painel /></RequireModule>,
});

function Painel() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data, isPending, isFetching } = useQuery({
    queryKey: ["painel"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const semanaAtras = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const [{ data: colabs }, { data: postos }, { data: presHoje }, { data: ocAbertas }, { data: feriasPend }, { data: presSemana }, { data: docs }, { data: visitasMes }] = await Promise.all([
        supabase.from("colaboradores").select("id,situacao,posto_id,arquivado").eq("arquivado", false),
        supabase.from("postos").select("id,nome,efetivo_previsto,ativo,supervisor_id").eq("ativo", true),
        supabase.from("presencas").select("id,status,hora_entrada,hora_saida").eq("data", hoje),
        supabase.from("ocorrencias").select("id,gravidade").eq("resolvida", false),
        supabase.from("ferias").select("id").eq("status", "solicitada"),
        supabase.from("presencas").select("data,status").gte("data", semanaAtras).lte("data", hoje),
        supabase.from("documentos").select("id,data_vencimento").not("data_vencimento", "is", null),
        supabase.from("visitas").select("id").gte("data_visita", hoje.slice(0, 8) + "01"),
      ]);
      return { colabs: colabs ?? [], postos: postos ?? [], presHoje: presHoje ?? [], ocAbertas: ocAbertas ?? [], feriasPend: feriasPend ?? [], presSemana: presSemana ?? [], docs: docs ?? [], visitasMes: visitasMes ?? [] };
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
  const semSaida = (data?.presHoje ?? []).filter((p) => p.hora_entrada && !p.hora_saida).length;
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const docsVencendo = (data?.docs ?? []).filter((d) => d.data_vencimento && d.data_vencimento <= em30).length;
  const visitasMes = (data?.visitasMes ?? []).length;

  const porDia: { dia: string; presentes: number; faltas: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const rows = (data?.presSemana ?? []).filter((r) => r.data === d);
    porDia.push({
      dia: new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      presentes: rows.filter((r) => r.status === "presente").length,
      faltas: rows.filter((r) => r.status === "falta" || r.status === "falta_justificada").length,
    });
  }

  const kpis = [
    { label: "Colaboradores ativos", value: ativos.length, icon: Users },
    { label: "Postos ativos", value: postos.length, icon: MapPin },
    { label: "Presentes hoje", value: presentesHoje, icon: ClipboardCheck },
    { label: "Faltas hoje", value: faltasHoje, icon: AlertTriangle, alert: faltasHoje > 0 },
    { label: "Em férias / afastados", value: colabs.filter((c) => c.situacao === "ferias" || c.situacao === "afastado").length, icon: Plane },
    { label: "Ocorrências abertas", value: ocAbertas.length, icon: AlertTriangle, alert: ocAbertas.some((o) => o.gravidade === "grave") },
    { label: "Férias pendentes", value: feriasPend.length, icon: Palmtree, alert: feriasPend.length > 0 },
    { label: "Postos com déficit", value: deficit.length, icon: AlertTriangle, alert: deficit.length > 0 },
    { label: "Pontos sem saída hoje", value: semSaida, icon: ClipboardCheck, alert: semSaida > 0 },
    { label: "Docs vencidos / a vencer", value: docsVencendo, icon: FileText, alert: docsVencendo > 0 },
    { label: "Visitas no mês", value: visitasMes, icon: ClipboardList },
  ];

  const roles = me?.roles ?? [];
  const metricTargets = ["/colaboradores", "/postos", "/presenca", "/presenca", "/colaboradores", "/ocorrencias", "/ferias", "/postos", "/presenca", "/documentos", "/visitas"] as const;
  const metricModules = ["colaboradores", "postos", "presenca", "presenca", "colaboradores", "ocorrencias", "ferias", "postos", "presenca", "documentos", "visitas"];
  const shortcuts = [
    { to: "/ponto", module: "ponto", label: "Meu ponto", icon: ClipboardCheck },
    { to: "/colaboradores", module: "colaboradores", label: "Colaboradores", icon: Users },
    { to: "/escalas", module: "escalas", label: "Escalas", icon: CalendarDays },
    { to: "/relatorios", module: "relatorios", label: "Relatórios", icon: FileText },
  ] as const;
  const hasPending = feriasPend.length > 0 || ocAbertas.length > 0 || deficit.length > 0 || docsVencendo > 0 || semSaida > 0 || semPosto > 0;
  function renderMetric(k: typeof kpis[number], index: number) {
    const content = <>
      <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{k.label}</span><span className={k.alert ? "rounded-md bg-warning/10 p-2 text-warning" : "rounded-md bg-accent p-2 text-primary"}><k.icon className="h-4 w-4" strokeWidth={1.7} /></span></div>
      <div className="mt-3 flex items-end justify-between">{isPending ? <Skeleton className="h-9 w-16" /> : <span className="font-display text-3xl font-semibold tabular-nums">{k.value}</span>}<ArrowUpRight className="h-4 w-4 text-muted-foreground" /></div>
      <div className="mt-3 border-t pt-3 text-[10px] text-muted-foreground">{index === 0 || index === 1 ? "Cadastro operacional" : "Registros do dia"}</div>
    </>;
    const target = metricTargets[index];
    return canAccess(roles, metricModules[index] ?? "") && target ? <Link key={k.label} to={target} className="metric rounded-lg border bg-card p-5">{content}</Link> : <div key={k.label} className="metric rounded-lg border bg-card p-5">{content}</div>;
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><div className="section-label mb-2">Central de operações</div><h1 className="text-2xl font-semibold md:text-3xl">Olá, {me?.profile?.nome?.split(" ")[0] ?? ""}<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe o dia a dia da Confidence.</p></div>
        <div className="flex items-center gap-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span><Button variant="outline" size="icon" aria-label="Atualizar painel" title="Atualizar painel" disabled={isFetching} onClick={() => qc.invalidateQueries({ queryKey: ["painel"] })}><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button></div>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">{shortcuts.filter((n) => canAccess(roles, n.module)).map((n) => <Button key={n.to} variant="outline" size="sm" asChild><Link to={n.to}><n.icon />{n.label}<ArrowRight className="ml-2" /></Link></Button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.slice(0, 4).map(renderMetric)}</div>
      <section className="mt-6 border-y bg-card px-5 py-4" aria-label="Resumo operacional">
        <div className="section-label mb-4">Resumo operacional</div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 xl:grid-cols-7">{kpis.slice(4).map((k, i) => {
          const content = <><k.icon className={k.alert ? "mb-2 h-4 w-4 text-warning" : "mb-2 h-4 w-4 text-muted-foreground"} /><div className="text-xl font-semibold tabular-nums">{isPending ? "—" : k.value}</div><div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{k.label}</div></>;
          const target = metricTargets[i + 4];
          return target && canAccess(roles, metricModules[i + 4] ?? "") ? <Link key={k.label} to={target} className="min-w-0 rounded-sm transition-colors hover:text-primary">{content}</Link> : <div key={k.label}>{content}</div>;
        })}</div>
      </section>
      <div className="mt-8 grid gap-x-7 gap-y-6 xl:grid-cols-3">
        <Card className="panel-section xl:col-span-2">
          <CardHeader className="px-0 pb-5 pt-0"><div className="section-label mb-2">Distribuição da equipe</div><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Efetivo por posto</CardTitle><div className="flex gap-4 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-1" />Alocados</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-2" />Previsto</span></div></div></CardHeader>
          <CardContent className="h-64 p-0">
            {porPosto.length === 0 ? (
              <EmptyState text="Cadastre postos para ver o gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porPosto} barSize={16}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" />
                  <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px" }} />
                  <Bar dataKey="alocados" name="Alocados" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previsto" name="Previsto" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="panel-section">
          <CardHeader className="px-0 pb-5 pt-0"><div className="section-label mb-2">Últimos 7 dias</div><CardTitle className="text-base">Presenças e faltas</CardTitle><div className="mt-2 flex gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-1" />Presentes</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-4" />Faltas</span></div></CardHeader>
          <CardContent className="h-64 p-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={porDia}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px" }} />
                <Area type="monotone" dataKey="presentes" name="Presentes" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.08} strokeWidth={2} />
                <Area type="monotone" dataKey="faltas" name="Faltas" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.04} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="panel-section border-t pt-6 xl:col-span-3">
          <CardHeader className="px-0 pt-0"><div className="section-label mb-2">Acompanhamento</div><CardTitle className="text-base">Pendências operacionais</CardTitle></CardHeader>
          <CardContent className="grid gap-3 p-0 text-sm md:grid-cols-2 xl:grid-cols-3">
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
            {docsVencendo > 0 && (
              <Link to="/documentos" className="flex items-start gap-2 rounded-md bg-warning/10 p-3">
                <FileText className="mt-0.5 h-4 w-4 text-warning" /> <span>{docsVencendo} documento(s) vencido(s) ou vencendo em 30 dias.</span>
              </Link>
            )}
            {semSaida > 0 && (
              <Link to="/presenca" className="flex items-start gap-2 rounded-md bg-muted p-3">
                <ClipboardCheck className="mt-0.5 h-4 w-4" /> <span>{semSaida} ponto(s) de hoje sem saída registrada.</span>
              </Link>
            )}
            {semPosto > 0 && (
              <Link to="/colaboradores" className="flex items-start gap-2 rounded-md bg-muted p-3">
                <Users className="mt-0.5 h-4 w-4" /> <span>{semPosto} colaborador(es) ativo(s) sem posto.</span>
              </Link>
            )}
            {!hasPending && <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5 text-success" />Nenhuma pendência no momento.</div>}
          </CardContent>
        </Card>
      </div>
      {canAccess(me?.roles ?? [], "postos") && <PostosComparativo />}
    </div>
  );
}
