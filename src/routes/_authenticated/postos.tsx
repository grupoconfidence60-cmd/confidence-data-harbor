import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, MapPin, Table2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditPostos } from "@/lib/labels";
import { geocodeEndereco } from "@/lib/geo.functions";

export const Route = createFileRoute("/_authenticated/postos")({
  head: () => ({ meta: [
    { title: "Postos de serviço — Grupo Confidence" },
    { name: "description", content: "Postos de serviço, endereços e efetivo da operação Confidence." },
    { property: "og:title", content: "Postos de serviço — Grupo Confidence" },
    { property: "og:description", content: "Postos de serviço, endereços e efetivo da operação Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="postos"><Postos /></RequireModule>,
});

type PostoRow = { id: string; nome: string; cliente: string | null; tipo: string | null; endereco: string | null; cidade: string | null; efetivo_previsto: number; supervisor_id: string | null; supervisor_ids?: string[] | null; ativo: boolean; observacoes: string | null; latitude: number | null; longitude: number | null; raio_metros: number };
type P = { id?: string; nome: string; cliente: string; tipo: string; endereco: string; cidade: string; efetivo_previsto: number; supervisor_id: string; supervisor_ids: string[]; ativo: boolean; observacoes: string; latitude: number | null; longitude: number | null; raio_metros: number };
type Supervisor = { user_id: string; profiles: { nome: string } | null };

const EMPTY: P = { nome: "", cliente: "", tipo: "Shopping", endereco: "", cidade: "", efetivo_previsto: 0, supervisor_id: "", supervisor_ids: [], ativo: true, observacoes: "", latitude: null, longitude: null, raio_metros: 150 };

const SUPERVISORES_LOCAIS = "confidence:postos:supervisores";
const SUPERVISORES_EVENTO = "confidence:postos:supervisores-atualizados";
const JANILSON_LOCAL_ID = "local:janilson-da-paz";

function lerSupervisoresLocais(): Record<string, string[]> {
  const raw = window.localStorage.getItem(SUPERVISORES_LOCAIS);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Seleções locais inválidas.");
  }
  const entries = Object.entries(parsed);
  if (entries.some(([, ids]) => !Array.isArray(ids) || !ids.every((id) => typeof id === "string"))) {
    throw new Error("Seleções locais inválidas.");
  }
  return Object.fromEntries(entries) as Record<string, string[]>;
}

function useSupervisoresLocais() {
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const carregar = () => {
      try { setSelecoes(lerSupervisoresLocais()); }
      catch { toast.error("Não foi possível ler os supervisores salvos neste navegador."); }
    };
    const sincronizar = (event: StorageEvent) => {
      if (event.key === SUPERVISORES_LOCAIS || event.key === null) carregar();
    };
    carregar();
    window.addEventListener(SUPERVISORES_EVENTO, carregar);
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener(SUPERVISORES_EVENTO, carregar);
      window.removeEventListener("storage", sincronizar);
    };
  }, []);
  return selecoes;
}

function idsSupervisores(p: { supervisor_id: string | null; supervisor_ids?: string[] | null }): string[] {
  const varios = (p.supervisor_ids ?? []).filter((v): v is string => Boolean(v));
  if (varios.length) return varios;
  return p.supervisor_id ? [p.supervisor_id] : [];
}

function paraFormulario(p: PostoRow): P {
  return {
    ...EMPTY,
    id: p.id,
    nome: p.nome,
    cliente: p.cliente ?? "",
    tipo: p.tipo ?? "",
    endereco: p.endereco ?? "",
    cidade: p.cidade ?? "",
    efetivo_previsto: p.efetivo_previsto ?? 0,
    supervisor_id: p.supervisor_id ?? "",
    supervisor_ids: idsSupervisores(p),
    ativo: p.ativo,
    observacoes: p.observacoes ?? "",
    latitude: p.latitude,
    longitude: p.longitude,
    raio_metros: p.raio_metros ?? 150,
  };
}

function Postos() {
  const { data: me } = useMe();
  const supervisoresLocais = useSupervisoresLocais();
  const canEdit = canEditPostos(me?.roles ?? []);
  const [editing, setEditing] = useState<P | null>(null);
  const [supervisorFilter, setSupervisorFilter] = useState("todos");
  const { data } = useQuery({
    queryKey: ["postos"],
    queryFn: async () => {
      const [{ data: postos }, { data: colabs }, { data: roles }] = await Promise.all([
        supabase.from("postos").select("*").order("nome"),
        supabase.from("colaboradores").select("posto_id").eq("arquivado", false).eq("situacao", "ativo"),
        supabase.from("user_roles").select("user_id").eq("role", "supervisor"),
      ]);
      const linhas = (postos ?? []) as unknown as PostoRow[];
      const ids = Array.from(new Set([
        ...(roles ?? []).map((r) => r.user_id as string),
        ...linhas.flatMap((p) => idsSupervisores(p)),
      ]));
      const perfis = ids.length
        ? ((await supabase.from("profiles").select("id,nome").in("id", ids)).data ?? [])
        : [];
      const sups = ids
        .map((id) => ({ user_id: id, profiles: { nome: perfis.find((p) => p.id === id)?.nome ?? "" } }))
        .sort((a, b) => (a.profiles.nome || "Supervisor sem nome").localeCompare(b.profiles.nome || "Supervisor sem nome", "pt-BR"));
      return { postos: linhas, colabs: colabs ?? [], sups };
    },
  });
  const supervisores: Supervisor[] = (data?.sups ?? []).map((supervisor) => ({
    ...supervisor,
    profiles: { nome: /^janilson(?:\s|$)/i.test(supervisor.profiles.nome.trim()) ? "Janilson da Paz" : supervisor.profiles.nome },
  }));
  if (!supervisores.some((supervisor) => supervisor.profiles?.nome === "Janilson da Paz")) {
    supervisores.push({ user_id: JANILSON_LOCAL_ID, profiles: { nome: "Janilson da Paz" } });
  }
  supervisores.sort((a, b) => (a.profiles?.nome || "Supervisor sem nome").localeCompare(b.profiles?.nome || "Supervisor sem nome", "pt-BR"));
  const nomeSupervisor = (id: string | null | undefined) =>
    id === JANILSON_LOCAL_ID ? "Janilson da Paz" : (id ? supervisores.find((s) => s.user_id === id)?.profiles?.nome : "") || undefined;
  const nomesSupervisores = (p: PostoRow) =>
    idsSupervisores(p).map((id) => nomeSupervisor(id)).filter((n): n is string => Boolean(n));
  const postosVisiveis = (data?.postos ?? []).map((posto) => {
    const ids = supervisoresLocais[posto.id];
    return ids === undefined ? posto : { ...posto, supervisor_ids: ids, supervisor_id: ids[0] ?? null };
  }).filter((posto) => {
    if (supervisorFilter === "todos") return true;
    const ids = idsSupervisores(posto);
    if (supervisorFilter === "sem-supervisor") return ids.length === 0;
    return ids.includes(supervisorFilter);
  });

  return (
    <div>
      <PageHeader title="Postos de serviço" description="Locais atendidos, efetivo e supervisão"
        actions={canEdit && <Button onClick={() => setEditing(EMPTY)}><Plus className="mr-1 h-4 w-4" />Novo posto</Button>} />
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 text-card-foreground">
        <div className="w-full space-y-2 sm:w-72">
          <Label htmlFor="postos-supervisor">Supervisor dos postos</Label>
          <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
            <SelectTrigger id="postos-supervisor" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os supervisores</SelectItem>
              <SelectItem value="sem-supervisor">Sem supervisor definido</SelectItem>
              {supervisores.map((supervisor) => (
                <SelectItem key={supervisor.user_id} value={supervisor.user_id}>{supervisor.profiles?.nome || "Supervisor sem nome"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {supervisorFilter !== "todos" && <Button variant="outline" onClick={() => setSupervisorFilter("todos")}>Limpar filtro</Button>}
        {data && <p role="status" className="py-2 text-sm text-muted-foreground">{postosVisiveis.length} de {data.postos.length} posto(s)</p>}
      </div>
      {!data?.postos.length ? <EmptyState text="Nenhum posto cadastrado." /> : !postosVisiveis.length ? <EmptyState text="Nenhum posto encontrado para o supervisor selecionado." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {postosVisiveis.map((p) => {
            const n = data.colabs.filter((c) => c.posto_id === p.id).length;
            const low = n < p.efetivo_previsto;
            const nomes = nomesSupervisores(p);
            return (
              <Card key={p.id} className={!p.ativo ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-display font-semibold">{p.nome}</div><div className="text-sm text-muted-foreground">{p.cliente || "—"} · {p.tipo || "—"}</div></div>
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => setEditing(paraFormulario(p))}><Pencil className="h-4 w-4" /></Button>}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="text-muted-foreground">{nomes.length > 1 ? "Supervisores" : "Supervisor"}</div>
                      <div className="break-words">{nomes.length ? nomes.join(", ") : "Não definido"}</div>
                      {supervisoresLocais[p.id] !== undefined && <p className="mt-1 text-xs text-muted-foreground">Supervisão salva neste navegador</p>}
                    </div>
                    <div className={`shrink-0 text-right font-display text-2xl font-semibold ${low ? "text-warning" : ""}`}>{n}<span className="text-sm text-muted-foreground">/{p.efetivo_previsto}</span></div>
                  </div>
                  {!p.ativo && <div className="mt-2 text-xs">Inativo</div>}
                  <div className={`mt-2 text-xs ${p.latitude != null ? "text-muted-foreground" : "text-warning"}`}>
                    {p.latitude != null ? `Ponto por GPS: raio de ${p.raio_metros} m` : "Ponto por GPS não configurado"}
                  </div>
                  <Button asChild variant="outline" className="mt-4 w-full"><Link to="/posto/$id" params={{ id: p.id }}><Table2 className="h-4 w-4" />Planilha de colaboradores</Link></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <PostoDialog value={editing} sups={editing.supervisor_ids.includes(JANILSON_LOCAL_ID) ? supervisores.filter((s) => s.profiles?.nome !== "Janilson da Paz").concat({ user_id: JANILSON_LOCAL_ID, profiles: { nome: "Janilson da Paz" } }) : supervisores} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PostoDialog({ value, sups, onClose }: { value: P; sups: Supervisor[]; onClose: () => void }) {
  const [f, setF] = useState(value);
  const [localizando, setLocalizando] = useState(false);
  const qc = useQueryClient();

  function marcarSupervisor(id: string, marcado: boolean) {
    setF((prev) => {
      const atuais = prev.supervisor_ids ?? [];
      const proximos = marcado ? Array.from(new Set([...atuais, id])) : atuais.filter((x) => x !== id);
      return { ...prev, supervisor_ids: proximos, supervisor_id: proximos[0] ?? "" };
    });
  }

  async function localizar() {
    if (localizando) return;
    if (!f.endereco.trim()) { toast.error("Preencha o endereço para localizar."); return; }
    setLocalizando(true);
    try {
      const r = await geocodeEndereco({ data: { endereco: f.endereco, cidade: f.cidade } });
      if (!r) { toast.error("Endereço não encontrado. Confira o endereço e a cidade."); return; }
      setF((prev) => ({ ...prev, latitude: r.lat, longitude: r.lng }));
      toast.success("Localização encontrada: " + r.descricao);
    } catch {
      toast.error("Não foi possível buscar a localização. Tente novamente.");
    } finally {
      setLocalizando(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ids = f.supervisor_ids ?? [];
    const outrosCamposAlterados = (Object.keys(value) as (keyof P)[]).some((key) =>
      key !== "supervisor_ids" && key !== "supervisor_id" && f[key] !== value[key]
    );
    if (outrosCamposAlterados && ids.includes(JANILSON_LOCAL_ID)) {
      toast.error("Janilson da Paz está disponível como opção local. Salve somente a supervisão nesta edição; os demais dados não foram salvos.");
      return;
    }
    if (f.id && !outrosCamposAlterados) {
      try {
        const selecoes = lerSupervisoresLocais();
        selecoes[f.id] = Array.from(new Set(ids));
        window.localStorage.setItem(SUPERVISORES_LOCAIS, JSON.stringify(selecoes));
        window.dispatchEvent(new Event(SUPERVISORES_EVENTO));
        toast.success(`${ids.length} supervisor(es) salvo(s) para este posto neste navegador.`);
        onClose();
      } catch {
        toast.error("Não foi possível salvar neste navegador. Sua seleção foi mantida; verifique se o armazenamento local está permitido.");
      }
      return;
    }
    if (ids.length !== value.supervisor_ids.length || ids.some((id, index) => id !== value.supervisor_ids[index])) {
      toast.error(f.id
        ? "Salve a supervisão separadamente: reabra a edição e altere apenas os supervisores. Os outros dados deste formulário ainda não foram salvos."
        : "Cadastre o posto primeiro, sem supervisores. Depois, edite apenas a supervisão para salvar os responsáveis neste navegador.");
      return;
    }
    const base = { nome: f.nome.trim(), cliente: f.cliente || null, tipo: f.tipo || null, endereco: f.endereco || null, cidade: f.cidade || null,
      efetivo_previsto: Math.max(0, Number(f.efetivo_previsto) || 0), supervisor_id: ids[0] ?? null, ativo: f.ativo, observacoes: f.observacoes || null,
      latitude: f.latitude, longitude: f.longitude, raio_metros: Math.max(20, Number(f.raio_metros) || 150) };
    const gravar = (payload: Record<string, unknown>) => f.id
      ? supabase.from("postos").update(payload as never).eq("id", f.id)
      : supabase.from("postos").insert(payload as never);
    const { error } = await gravar({ ...base, supervisor_ids: ids });
    if (error) {
      toast.error(/supervisor_ids/i.test(error.message)
        ? "Não foi possível salvar os supervisores. O armazenamento de múltiplos responsáveis precisa ser habilitado. Sua seleção foi mantida neste formulário."
        : error.message);
      return;
    }
    toast.success("Posto salvo.");
    qc.invalidateQueries();
    onClose();
  }
  const inp = (k: keyof P, label: string, type = "text") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={f[k] as string | number} required={k === "nome"} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar posto" : "Novo posto"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {inp("nome", "Nome do posto *")}{inp("cliente", "Cliente")}{inp("tipo", "Tipo")}{inp("cidade", "Cidade")}
          {inp("endereco", "Endereço")}{inp("efetivo_previsto", "Efetivo previsto", "number")}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Supervisores responsáveis</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
              {!sups.length && <p className="text-sm text-muted-foreground">Nenhum supervisor cadastrado.</p>}
              {sups.map((s) => {
                const marcado = (f.supervisor_ids ?? []).includes(s.user_id);
                return (
                  <label key={s.user_id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox checked={marcado} onCheckedChange={(v) => marcarSupervisor(s.user_id, v === true)} />
                    <span>{s.profiles?.nome || "Supervisor sem nome"}</span>
                  </label>
                );
              })}
            </div>
            <p role="status" aria-live="polite" className="text-sm font-medium text-foreground">{f.supervisor_ids.length} supervisor(es) selecionado(s)</p>
            <p className="text-xs text-muted-foreground">Marque os dois supervisores e clique em Salvar. Para um posto já cadastrado, altere somente os supervisores nesta edição: a seleção será salva neste navegador para este posto, sem alterar permissões de acesso. Outros dados do posto devem ser editados separadamente.</p>
          </div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /><Label>Posto ativo</Label></div>
          <div className="space-y-1.5"><Label>Raio permitido p/ ponto (metros)</Label>
            <Input type="number" min={20} value={f.raio_metros} onChange={(e) => setF({ ...f, raio_metros: Number(e.target.value) })} /></div>
          <div className="space-y-1.5">
            <Label>Localização do ponto (GPS)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={localizar} disabled={localizando}>
                <MapPin className="mr-1 h-4 w-4" />{localizando ? "Localizando…" : "Localizar endereço"}
              </Button>
              {f.latitude != null && <span className="text-xs text-muted-foreground">{f.latitude.toFixed(5)}, {f.longitude?.toFixed(5)}</span>}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
