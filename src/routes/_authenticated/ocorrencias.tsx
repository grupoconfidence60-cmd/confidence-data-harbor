import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditOcorrencias, canCreateOcorrencias, GRAVIDADE_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({ meta: [
    { title: "Solicitações — Grupo Confidence" },
    { name: "description", content: "Registro e acompanhamento de solicitações nos postos Confidence." },
    { property: "og:title", content: "Solicitações — Grupo Confidence" },
    { property: "og:description", content: "Registro e acompanhamento de solicitações nos postos Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="ocorrencias"><Ocorrencias /></RequireModule>,
});

const TIPOS = ["Segurança", "Disciplinar", "Operacional", "Cliente", "Equipamento", "Outro"];

type O = { posto_id: string; colaborador_id: string; tipo: string; titulo: string; descricao: string; gravidade: string; data_ocorrencia: string };
const EMPTY: O = { posto_id: "", colaborador_id: "", tipo: "Operacional", titulo: "", descricao: "", gravidade: "leve", data_ocorrencia: new Date().toISOString().slice(0, 16) };

function Ocorrencias() {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  if (roles.length > 0 && roles.every((r) => r === "colaborador")) return <MinhasOcorrencias />;
  return <OcorrenciasGestao />;
}

const agoraLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function MinhasOcorrencias() {
  const qc = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState(agoraLocal);
  const [enviando, setEnviando] = useState(false);
  const { data } = useQuery({
    queryKey: ["minhas-ocorrencias"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return { colab: null, lista: [] };
      const [{ data: colab }, { data: lista }] = await Promise.all([
        supabase.from("colaboradores").select("id, posto_id").eq("user_id", uid).eq("arquivado", false).maybeSingle(),
        supabase.from("ocorrencias").select("id, descricao, data_ocorrencia, resolvida").eq("registrado_por", uid).order("data_ocorrencia", { ascending: false }).limit(30),
      ]);
      return { colab, lista: lista ?? [] };
    },
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = descricao.trim();
    if (!texto) return;
    setEnviando(true);
    const { error } = await supabase.from("ocorrencias").insert({
      posto_id: data?.colab?.posto_id ?? null, colaborador_id: data?.colab?.id ?? null,
      tipo: "Relato do colaborador", titulo: texto.slice(0, 60), descricao: texto, gravidade: "leve",
      data_ocorrencia: new Date(quando).toISOString(),
    });
    setEnviando(false);
    if (error) { toast.error("Não foi possível enviar a solicitação. Tente novamente."); return; }
    toast.success("Solicitação enviada para a empresa.");
    setDescricao(""); setQuando(agoraLocal());
    qc.invalidateQueries({ queryKey: ["minhas-ocorrencias"] });
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Nova solicitação" description="Descreva o que aconteceu" />
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={enviar} className="grid gap-4">
            <div className="space-y-1.5"><Label>Data e hora</Label>
              <Input type="datetime-local" required value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Descrição do ocorrido</Label>
              <Textarea required rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Conte o que aconteceu…" /></div>
            <Button type="submit" size="lg" disabled={enviando}>{enviando ? "Enviando…" : "Enviar solicitação"}</Button>
          </form>
        </CardContent>
      </Card>
      <h2 className="mb-3 text-lg font-semibold">Minhas solicitações</h2>
      {(data?.lista ?? []).length === 0 ? <EmptyState text="Nenhuma solicitação enviada." /> : (
        <div className="grid gap-2">
          {data!.lista.map((o) => (
            <Card key={o.id}><CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{new Date(o.data_ocorrencia).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <Badge variant={o.resolvida ? "secondary" : "outline"}>{o.resolvida ? "Resolvida" : "Enviada"}</Badge>
              </div>
              <p className="mt-1 text-sm">{o.descricao}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OcorrenciasGestao() {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const canEdit = canEditOcorrencias(roles);
  const canCreate = canCreateOcorrencias(roles);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("abertas");
  const { data } = useQuery({
    queryKey: ["ocorrencias"],
    queryFn: async () => {
      const [{ data: oc }, { data: postos }, { data: colabs }] = await Promise.all([
        supabase.from("ocorrencias").select("*").order("data_ocorrencia", { ascending: false }),
        supabase.from("postos").select("id, nome").order("nome"),
        supabase.from("colaboradores").select("id, nome").eq("arquivado", false).order("nome"),
      ]);
      return { oc: oc ?? [], postos: postos ?? [], colabs: colabs ?? [] };
    },
  });
  const lista = (data?.oc ?? []).filter((o) => (filtro === "abertas" ? !o.resolvida : filtro === "resolvidas" ? o.resolvida : true));
  const nome = (list: { id: string; nome: string }[], id: string | null) => list.find((x) => x.id === id)?.nome ?? "—";

  async function resolver(id: string) {
    const resolucao = window.prompt("Descreva a resolução:");
    if (resolucao === null) return;
    const { error } = await supabase.from("ocorrencias").update({ resolvida: true, resolucao: resolucao || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação resolvida.");
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  return (
    <div>
      <PageHeader title="Solicitações" description="Registro e acompanhamento de solicitações nos postos"
        actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nova solicitação</Button>} />
      <div className="mb-4">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value="resolvidas">Resolvidas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {lista.length === 0 ? <EmptyState text="Nenhuma solicitação encontrada." /> : (
        <div className="grid gap-3">
          {lista.map((o) => (
            <Card key={o.id} className={o.resolvida ? "opacity-70" : ""}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.titulo}</span>
                    <Badge variant={o.gravidade === "grave" ? "destructive" : o.gravidade === "moderada" ? "default" : "secondary"}>{GRAVIDADE_LABELS[o.gravidade]}</Badge>
                    <Badge variant="outline">{o.tipo}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {nome(data?.postos ?? [], o.posto_id)} · {nome(data?.colabs ?? [], o.colaborador_id)} · {new Date(o.data_ocorrencia).toLocaleString("pt-BR")}
                  </div>
                  {o.descricao && <p className="mt-2 text-sm">{o.descricao}</p>}
                  {o.resolvida && o.resolucao && <p className="mt-2 text-sm text-muted-foreground">Resolução: {o.resolucao}</p>}
                </div>
                {canEdit && !o.resolvida && (
                  <Button size="sm" variant="outline" onClick={() => resolver(o.id)}><CheckCircle2 className="mr-1 h-4 w-4" />Resolver</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && <OcorrenciaDialog postos={data?.postos ?? []} colabs={data?.colabs ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function OcorrenciaDialog({ postos, colabs, onClose }: { postos: { id: string; nome: string }[]; colabs: { id: string; nome: string }[]; onClose: () => void }) {
  const [f, setF] = useState(EMPTY);
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("ocorrencias").insert({
      posto_id: f.posto_id || null, colaborador_id: f.colaborador_id || null, tipo: f.tipo, titulo: f.titulo.trim(),
      descricao: f.descricao || null, gravidade: f.gravidade as "leve" | "moderada" | "grave",
      data_ocorrencia: new Date(f.data_ocorrencia).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação registrada.");
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Título *</Label><Input required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Gravidade</Label>
            <Select value={f.gravidade} onValueChange={(v) => setF({ ...f, gravidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(GRAVIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Posto</Label>
            <Select value={f.posto_id || "none"} onValueChange={(v) => setF({ ...f, posto_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Não se aplica</SelectItem>{postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Colaborador envolvido</Label>
            <Select value={f.colaborador_id || "none"} onValueChange={(v) => setF({ ...f, colaborador_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Não se aplica</SelectItem>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Data e hora</Label><Input type="datetime-local" value={f.data_ocorrencia} onChange={(e) => setF({ ...f, data_ocorrencia: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Textarea value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Registrar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
