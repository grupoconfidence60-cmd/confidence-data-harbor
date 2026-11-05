import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/page";
import { getHistoricoPlanilha } from "@/lib/historico.functions";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fmt = (d?: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export function HistoricoPlanilha() {
  const fetchRows = useServerFn(getHistoricoPlanilha);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["materiais", "historico-planilha"], queryFn: () => fetchRows(), staleTime: Infinity });
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = norm(q);
    return data
      .filter((r) => r.tipo === tipo && (!t || norm(`${r.nome ?? ""} ${r.posto ?? ""} ${r.itens} ${r.fornecedor ?? ""} ${r.cargo ?? ""}`).includes(t)))
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
  }, [data, tipo, q]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (error) return <EmptyState text="Não foi possível carregar o histórico." />;

  return <div className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row">
      <Tabs value={tipo} onValueChange={(v) => setTipo(v as "saida" | "entrada")}><TabsList><TabsTrigger value="saida">Saídas ({data.filter((r) => r.tipo === "saida").length})</TabsTrigger><TabsTrigger value="entrada">Compras ({data.filter((r) => r.tipo === "entrada").length})</TabsTrigger></TabsList></Tabs>
      <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder={tipo === "saida" ? "Buscar nome, posto ou item…" : "Buscar item ou fornecedor…"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar no histórico" /></div>
    </div>
    {!rows.length ? <EmptyState text="Nada encontrado." /> : <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[640px] text-sm">
      <thead className="bg-muted/50"><tr>{(tipo === "saida" ? ["Data", "Colaborador", "Posto", "Itens", "Devolução"] : ["Data", "Item", "Qtd.", "Valor", "Fornecedor"]).map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => tipo === "saida"
        ? <tr key={i} className="border-t align-top"><td className="whitespace-nowrap px-3 py-2">{fmt(r.data)}</td><td className="px-3 py-2"><p className="font-medium">{r.nome ?? "—"}</p><p className="text-xs text-muted-foreground">{r.cargo}</p></td><td className="px-3 py-2">{r.posto ?? "—"}</td><td className="max-w-80 px-3 py-2">{r.itens}{r.observacoes && <p className="text-xs text-muted-foreground">{r.observacoes}</p>}</td><td className="whitespace-nowrap px-3 py-2">{r.data_devolucao ? <Badge variant="secondary">{fmt(r.data_devolucao)}</Badge> : <span className="text-muted-foreground">Em uso</span>}</td></tr>
        : <tr key={i} className="border-t"><td className="whitespace-nowrap px-3 py-2">{fmt(r.data)}</td><td className="px-3 py-2 font-medium">{r.itens}</td><td className="px-3 py-2 tabular-nums">{r.quantidade ?? "—"}</td><td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.valor != null ? r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td><td className="px-3 py-2">{r.fornecedor && r.fornecedor !== "(Não encontrado)" ? r.fornecedor : "—"}</td></tr>)}</tbody>
    </table></div>}
  </div>;
}
