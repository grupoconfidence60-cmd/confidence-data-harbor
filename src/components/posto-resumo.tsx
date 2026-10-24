import { FuncaoBadge } from "@/components/funcao-badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { SITUACAO_LABELS } from "@/lib/labels";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const fmt = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("pt-BR");

export function PostoResumo({ postoId }: { postoId: string }) {
  const { data } = useQuery({ queryKey: ["posto-resumo", postoId], queryFn: async () => {
    const [posto, equipe, presencas, ocorrencias, visitas, inspecoes, materiais] = await Promise.all([
      supabase.from("postos").select("efetivo_previsto,tipo,observacoes").eq("id", postoId).maybeSingle(),
      supabase.from("colaboradores").select("id,nome,matricula,situacao,funcoes(nome)").eq("posto_id", postoId).eq("arquivado", false).order("nome"),
      supabase.from("presencas").select("status").eq("posto_id", postoId).eq("data", hoje()),
      supabase.from("ocorrencias").select("id,titulo,gravidade,data_ocorrencia").eq("posto_id", postoId).eq("resolvida", false).order("data_ocorrencia", { ascending: false }).limit(5),
      supabase.from("visitas").select("data_visita,pendencias,pendencia_resolvida").eq("posto_id", postoId).order("data_visita", { ascending: false }).limit(1),
      supabase.from("inspecoes").select("data,nao_conformes").eq("posto_id", postoId).order("data", { ascending: false }).limit(1),
      supabase.from("material_entregas").select("quantidade").eq("posto_id", postoId).is("data_devolucao", null),
    ]);
    return { posto: posto.data, equipe: equipe.data ?? [], presencas: presencas.data ?? [], ocorrencias: ocorrencias.data ?? [], visita: visitas.data?.[0], inspecao: inspecoes.data?.[0], materiais: (materiais.data ?? []).reduce((s, m) => s + m.quantidade, 0) };
  } });
  if (!data) return <p className="text-muted-foreground">Carregando visão geral…</p>;
  const ativos = data.equipe.filter((c) => c.situacao === "ativo").length;
  const presentes = data.presencas.filter((p) => p.status === "presente").length;
  const faltas = data.presencas.filter((p) => p.status === "falta" || p.status === "falta_justificada" || p.status === "atestado").length;
  const kpis: [string, string | number, (string | undefined)?][] = [
    ["Efetivo ativo / previsto", `${ativos} / ${data.posto?.efetivo_previsto ?? 0}`, ativos < (data.posto?.efetivo_previsto ?? 0) ? "Abaixo do previsto" : undefined],
    ["Presentes hoje", presentes, faltas ? `${faltas} ausência(s)` : undefined],
    ["Ocorrências abertas", data.ocorrencias.length],
    ["Materiais em uso", data.materiais],
  ];
  return <div className="space-y-6">
    <div className="grid grid-cols-2 divide-x border-y py-4 md:grid-cols-4">{kpis.map(([l, v, alert]) => <div key={l} className="px-3 sm:px-5"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p>{alert && <p className="text-xs text-destructive">{alert}</p>}</div>)}</div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-lg border bg-card p-4 lg:col-span-2"><h2 className="mb-3 font-semibold">Equipe do posto ({data.equipe.length})</h2>
        {!data.equipe.length ? <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p> : <ul className="divide-y text-sm">{data.equipe.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-2"><Link to="/colaborador/$id" params={{ id: c.id }} className="min-w-0 hover:underline"><span className="font-medium">{c.nome}</span> <span className="text-muted-foreground">· {c.matricula}</span> <FuncaoBadge nome={c.funcoes?.nome} /></Link><Badge variant={c.situacao === "ativo" ? "secondary" : "outline"}>{SITUACAO_LABELS[c.situacao]}</Badge></li>)}</ul>}
      </section>
      <div className="space-y-4">
        <section className="rounded-lg border bg-card p-4"><h2 className="mb-2 font-semibold">Ocorrências abertas</h2>{!data.ocorrencias.length ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : <ul className="space-y-1 text-sm">{data.ocorrencias.map((o) => <li key={o.id} className="flex justify-between gap-2"><span className="min-w-0 break-words">{o.titulo}</span><span className={o.gravidade === "grave" ? "text-destructive" : "text-muted-foreground"}>{fmt(o.data_ocorrencia)}</span></li>)}</ul>}</section>
        <section className="rounded-lg border bg-card p-4 text-sm"><h2 className="mb-2 font-semibold">Supervisão</h2>
          <p>Última visita: <strong>{data.visita ? fmt(data.visita.data_visita) : "nenhuma"}</strong>{data.visita?.pendencias && !data.visita.pendencia_resolvida && <span className="text-destructive"> · pendência aberta</span>}</p>
          <p>Última inspeção: <strong>{data.inspecao ? fmt(data.inspecao.data) : "nenhuma"}</strong>{data.inspecao && <span className={data.inspecao.nao_conformes ? "text-destructive" : "text-muted-foreground"}> · {data.inspecao.nao_conformes ? `${data.inspecao.nao_conformes} não conforme(s)` : "tudo conforme"}</span>}</p>
        </section>
      </div>
    </div>
  </div>;
}
