import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { monthDays } from "@/lib/planilha";

type Person = { id: string; nome: string; matricula: string; situacao: string };
type Props = {
  postoId: string;
  month: string;
  rows: { colaborador_id: string }[];
  people: Person[];
};

const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");

export function PlanilhaFerias({ postoId, month, rows, people }: Props) {
  const ids = [...new Set(rows.map((row) => row.colaborador_id))].sort();
  const validMonth = /^\d{4}-\d{2}$/.test(month) && monthDays(month) > 0;
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["ferias", "planilha", postoId, month, ids],
    enabled: validMonth && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("ferias")
        .select("id,colaborador_id,data_inicio,data_fim,status,cobertura")
        .in("colaborador_id", ids)
        .eq("tipo", "ferias")
        .in("status", ["aprovada", "em_gozo", "concluida"])
        .lte("data_inicio", `${month}-${String(monthDays(month)).padStart(2, "0")}`)
        .gte("data_fim", `${month}-01`)
        .order("data_inicio");
      if (error) throw error;
      return data;
    },
  });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const missing = month === today.slice(0, 7)
    ? people.filter((person) => ids.includes(person.id) && person.situacao === "ferias" && !data.some((period) => period.colaborador_id === person.id))
    : [];

  if (!validMonth || ids.length === 0) return null;

  return <section className="mb-5 space-y-3 rounded-lg border bg-card p-4 text-card-foreground" aria-label="Férias e coberturas da planilha">
    <div className="space-y-1">
      <h3 className="font-semibold">Férias e coberturas · {month.slice(5)}/{month.slice(0, 4)}</h3>
      <p className="text-sm text-muted-foreground">Colaboradores incluídos nesta planilha com férias confirmadas no mês. Informar a cobertura não altera os plantões.</p>
    </div>
    {isPending ? <p className="text-sm text-muted-foreground" role="status">Carregando férias…</p> : isError ? <div className="flex flex-wrap items-center gap-3" role="alert">
      <p className="text-sm text-destructive">Não foi possível carregar as férias deste mês.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
    </div> : <>
      {data.length === 0 && missing.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colaborador desta planilha com férias confirmadas no mês.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((period) => {
          const person = people.find((item) => item.id === period.colaborador_id);
          const active = period.status !== "concluida" && period.data_inicio <= today && period.data_fim >= today;
          return <div key={period.id} className="space-y-3 rounded-md border bg-background p-3 text-foreground">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{person?.nome ?? "Colaborador indisponível"}</p>
                <p className="text-xs text-muted-foreground">Matrícula: {person?.matricula ?? "—"}</p>
              </div>
              <Badge variant={active ? "default" : "secondary"}>{active ? "Em férias agora" : period.data_fim < today || period.status === "concluida" ? "Férias encerradas" : "Férias programadas"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{fmt(period.data_inicio)} a {fmt(period.data_fim)}</p>
            <CoberturaForm key={`${period.id}:${period.cobertura ?? ""}`} feriasId={period.id} inicial={period.cobertura ?? ""} nomeColaborador={person?.nome ?? "colaborador"} />
          </div>;
        })}
        {missing.map((person) => <div key={person.id} className="space-y-2 rounded-md border bg-background p-3 text-foreground">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-medium">{person.nome}</p><p className="text-xs text-muted-foreground">Matrícula: {person.matricula}</p></div>
            <Badge variant="outline">Em férias no cadastro</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Sem período confirmado neste mês. Registre ou confirme o período na tela de Férias para informar a cobertura.</p>
        </div>)}
      </div>
    </>}
  </section>;
}

function CoberturaForm({ feriasId, inicial, nomeColaborador }: { feriasId: string; inicial: string; nomeColaborador: string }) {
  const [nome, setNome] = useState(inicial);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const inputId = `planilha-cobertura-${feriasId}`;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || nome.trim() === inicial.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("definir_cobertura", { _ferias_id: feriasId, _nome: nome.trim() });
      if (error) throw error;
      toast.success("Cobertura salva.");
      await qc.invalidateQueries({ queryKey: ["ferias"] });
    } catch {
      toast.error("Não foi possível salvar a cobertura. Verifique sua permissão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={save} className="space-y-2">
    <Label htmlFor={inputId}>Nome do vigia na cobertura</Label>
    <div className="flex flex-wrap gap-2">
      <Input id={inputId} className="min-w-0 flex-1 basis-48" aria-label={`Vigia cobrindo ${nomeColaborador}`} placeholder="Digite o nome do vigia" maxLength={120} value={nome} disabled={saving} onChange={(event) => setNome(event.target.value)} />
      <Button type="submit" variant="outline" disabled={saving || nome.trim() === inicial.trim()}>{saving ? "Salvando…" : "Salvar cobertura"}</Button>
    </div>
  </form>;
}
