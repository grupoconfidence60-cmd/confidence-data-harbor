import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PostosComparativo() {
  const { data } = useQuery({ queryKey: ["painel", "postos"], queryFn: async () => {
    const hoje = new Date().toLocaleDateString("sv-SE");
    const [postos, colab, pres, oc, insp] = await Promise.all([
      supabase.from("postos").select("id,nome,efetivo_previsto").eq("ativo", true).order("nome"),
      supabase.from("colaboradores").select("posto_id").eq("arquivado", false).eq("situacao", "ativo"),
      supabase.from("presencas").select("posto_id,status").eq("data", hoje),
      supabase.from("ocorrencias").select("posto_id").eq("resolvida", false),
      supabase.from("inspecoes").select("posto_id,nao_conformes,data").order("data", { ascending: false }),
    ]);
    const count = <T extends { posto_id: string | null }>(rows: T[] | null, id: string, f: (r: T) => boolean = () => true) => (rows ?? []).filter((r) => r.posto_id === id && f(r)).length;
    return (postos.data ?? []).map((p) => ({ ...p, ativos: count(colab.data, p.id), presentes: count(pres.data, p.id, (r) => r.status === "presente"), ocorrencias: count(oc.data, p.id), ultimaInsp: (insp.data ?? []).find((i) => i.posto_id === p.id) }));
  } });
  if (!data?.length) return null;
  return <Card className="mt-6"><CardHeader><CardTitle>Comparativo dos postos</CardTitle></CardHeader><CardContent className="overflow-x-auto">
    <table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["Posto", "Efetivo ativo / previsto", "Presentes hoje", "Ocorrências abertas", "Última inspeção"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
      <tbody>{data.map((p) => <tr key={p.id} className="border-t">
        <td className="px-2 py-2"><Link to="/posto/$id" params={{ id: p.id }} className="font-medium hover:underline">{p.nome}</Link></td>
        <td className={`px-2 ${p.ativos < p.efetivo_previsto ? "text-destructive" : ""}`}>{p.ativos} / {p.efetivo_previsto}</td>
        <td className="px-2">{p.presentes}</td>
        <td className={`px-2 ${p.ocorrencias ? "text-destructive" : ""}`}>{p.ocorrencias}</td>
        <td className="px-2 text-muted-foreground">{p.ultimaInsp ? `${new Date(`${p.ultimaInsp.data}T12:00:00`).toLocaleDateString("pt-BR")}${p.ultimaInsp.nao_conformes ? ` · ${p.ultimaInsp.nao_conformes} não conforme(s)` : " · conforme"}` : "—"}</td>
      </tr>)}</tbody></table>
  </CardContent></Card>;
}
