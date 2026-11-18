import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Phone, Save, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import {
  canEditIntermitentes,
  DISPONIBILIDADE_INTERMITENTE,
  isPostoIntermitentes,
  normalizarDisponibilidade,
  disponibilidadeValida,
  validarDisponibilidade,
  type DisponibilidadeIntermitente,
} from "@/lib/intermitentes";
import { FuncaoBadge } from "@/components/funcao-badge";
import { EmptyState } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Draft = { status: DisponibilidadeIntermitente; detalhe: string; postoDestinoId: string };

export function Intermitentes({ postoId }: { postoId: string }) {
  const { data: me } = useMe();
  const canEdit = canEditIntermitentes(me?.roles ?? []);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: ["intermitentes", postoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id,nome,matricula,telefone,situacao,disponibilidade_status,disponibilidade_detalhe,funcoes(nome)")
        .eq("posto_id", postoId)
        .eq("arquivado", false)
        .neq("situacao", "desligado")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: postos = [], isPending: postosPending, isError: postosError } = useQuery({
    queryKey: ["intermitentes", "postos-destino"],
    queryFn: async () => {
      const { data, error } = await supabase.from("postos").select("id,nome,tipo,ativo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });
  const destinos = useMemo(() => postos.filter((posto) => !isPostoIntermitentes(posto)), [postos]);

  const visible = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (filter === "todos" || row.disponibilidade_status === filter)
      && (!term || `${row.nome} ${row.matricula} ${row.telefone ?? ""}`.toLocaleLowerCase("pt-BR").includes(term));
  }), [rows, search, filter]);

  function draftFor(row: (typeof rows)[number]): Draft {
    return drafts[row.id] ?? {
      status: disponibilidadeValida(row.disponibilidade_status) ? row.disponibilidade_status : "disponivel",
      detalhe: row.disponibilidade_detalhe ?? "",
      postoDestinoId: "",
    };
  }

  function change(id: string, value: Partial<Draft>) {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(row), ...value } }));
  }

  async function save(row: (typeof rows)[number]) {
    if (!canEdit || saving) return;
    const draft = draftFor(row);
    const validation = validarDisponibilidade(draft.status, draft.detalhe, draft.postoDestinoId);
    if (validation) { toast.error(validation); return; }
    setSaving(row.id);
    try {
      if (draft.status === "ocupado") {
        const destino = destinos.find((posto) => posto.id === draft.postoDestinoId);
        if (!destino) throw new Error("Selecione um posto ativo para continuar.");
        const { error } = await supabase.rpc("alocar_reserva", { _colab: row.id, _posto: destino.id });
        if (error) throw error;
        toast.success(`${row.nome} foi alocado em ${destino.nome}.`);
      } else {
        const { error } = await supabase
          .from("colaboradores")
          .update(normalizarDisponibilidade(draft.status, draft.detalhe))
          .eq("id", row.id)
          .select("id")
          .single();
        if (error) throw error;
        toast.success(`Situação de ${row.nome} atualizada.`);
      }
      setDrafts((current) => { const next = { ...current }; delete next[row.id]; return next; });
      await qc.invalidateQueries();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error(`Não foi possível salvar: ${message}`);
    } finally {
      setSaving(null);
    }
  }

  const counts = {
    disponivel: rows.filter((row) => row.disponibilidade_status === "disponivel").length,
    ocupado: rows.filter((row) => row.disponibilidade_status === "ocupado").length,
    cobrindo: rows.filter((row) => row.disponibilidade_status === "cobrindo").length,
  };

  return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(DISPONIBILIDADE_INTERMITENTE) as DisponibilidadeIntermitente[]).map((status) => <button
        type="button"
        key={status}
        onClick={() => setFilter(filter === status ? "todos" : status)}
        aria-pressed={filter === status}
        className={`rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary ${filter === status ? "border-primary ring-1 ring-primary" : ""}`}
      >
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{DISPONIBILIDADE_INTERMITENTE[status]}</span><Badge variant={status === "disponivel" ? "default" : status === "ocupado" ? "secondary" : "outline"}>{counts[status]}</Badge></div>
      </button>)}
    </div>

    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-end md:justify-between">
        <div><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><UsersRound className="h-5 w-5 text-primary" />Banco de intermitentes</h2><p className="mt-1 text-sm text-muted-foreground">Para alocar, selecione “Em ocupação”, escolha o posto e confirme. A pessoa passará a constar no posto escolhido.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9 sm:w-64" aria-label="Buscar intermitente" placeholder="Nome, matrícula ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filtrar disponibilidade" className="sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem>{Object.entries(DISPONIBILIDADE_INTERMITENTE).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>

      {postosError && <p role="alert" className="border-b bg-destructive/5 p-3 text-sm text-destructive">Não foi possível carregar os postos de destino. Recarregue a página antes de alocar.</p>}
      {isPending ? <p className="p-5 text-sm text-muted-foreground">Carregando intermitentes…</p> : isError ? <p role="alert" className="p-5 text-sm text-destructive">Não foi possível carregar os intermitentes.</p> : !visible.length ? <div className="p-4"><EmptyState text={rows.length ? "Nenhum intermitente encontrado neste filtro." : "Nenhum intermitente neste posto."} /></div> : <div>
        {visible.map((row) => {
          const draft = draftFor(row);
          const changed = draft.status !== row.disponibilidade_status
            || (draft.status === "cobrindo" && draft.detalhe.trim() !== (row.disponibilidade_detalhe ?? ""))
            || (draft.status === "ocupado" && Boolean(draft.postoDestinoId));
          return <article key={row.id} className="grid gap-4 border-b p-4 last:border-b-0 xl:grid-cols-[minmax(230px,1.2fr)_minmax(190px,.75fr)_minmax(230px,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{row.nome}</h3><FuncaoBadge nome={row.funcoes?.nome} /></div>
              <p className="mt-1 text-xs text-muted-foreground">Matrícula {row.matricula}{row.situacao !== "ativo" ? ` · ${row.situacao === "ferias" ? "Férias" : "Afastado"}` : ""}</p>
              <p className="mt-2 flex items-center gap-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" />{row.telefone ? <a className="hover:underline" href={`tel:${row.telefone.replace(/\D/g, "")}`}>{row.telefone}</a> : <span className="text-warning">Telefone não cadastrado</span>}</p>
            </div>
            <div className="space-y-1.5"><Label>Situação atual</Label><Select value={draft.status} disabled={!canEdit || saving === row.id} onValueChange={(value) => change(row.id, { status: value as DisponibilidadeIntermitente })}><SelectTrigger aria-label={`Situação de ${row.nome}`}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DISPONIBILIDADE_INTERMITENTE).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5">
              <Label>{draft.status === "cobrindo" ? "Quem está sendo coberto" : draft.status === "ocupado" ? "Posto de destino" : "Detalhe"}</Label>
              {draft.status === "ocupado" ? <Select value={draft.postoDestinoId} disabled={!canEdit || saving === row.id || postosPending || postosError} onValueChange={(value) => change(row.id, { postoDestinoId: value })}>
                <SelectTrigger aria-label={`Posto de destino de ${row.nome}`}><SelectValue placeholder={postosPending ? "Carregando postos…" : "Selecione o posto"} /></SelectTrigger>
                <SelectContent>{destinos.map((posto) => <SelectItem key={posto.id} value={posto.id}><span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{posto.nome}</span></SelectItem>)}</SelectContent>
              </Select> : <Input aria-label={`Detalhe de ${row.nome}`} disabled={!canEdit || saving === row.id || draft.status === "disponivel"} value={draft.status === "disponivel" ? "" : draft.detalhe} placeholder={draft.status === "cobrindo" ? "Nome do colaborador" : "Nenhum detalhe necessário"} onChange={(event) => change(row.id, { detalhe: event.target.value })} />}
            </div>
            {canEdit && <Button className="xl:mb-0" disabled={!changed || saving === row.id} onClick={() => void save(row)}><Save className="h-4 w-4" />{saving === row.id ? "Salvando…" : draft.status === "ocupado" ? "Alocar no posto" : "Salvar"}</Button>}
          </article>;
        })}
      </div>}
    </div>
  </section>;
}
