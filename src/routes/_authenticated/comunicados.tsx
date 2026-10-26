import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CheckCheck, CheckCircle2, Megaphone, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, EmptyState, RequireModule } from "@/components/page";
import { canManageComunicados } from "@/lib/labels";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/comunicados")({
  head: () => ({ meta: [
    { title: "Comunicados — Grupo Confidence" },
    { name: "description", content: "Comunicados oficiais da administração e confirmações de leitura do Grupo Confidence." },
    { property: "og:title", content: "Comunicados — Grupo Confidence" },
    { property: "og:description", content: "Avisos oficiais e acompanhamento de leitura da equipe Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="comunicados"><Comunicados /></RequireModule>,
});

function Comunicados() {
  const { data: me } = useMe();
  const manage = canManageComunicados(me?.roles ?? []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ativos");
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ["comunicados", me?.id],
    enabled: Boolean(me?.id),
    queryFn: async () => {
      const [posts, reads] = await Promise.all([
        supabase.from("comunicados").select("*").order("created_at", { ascending: false }),
        supabase.from("comunicado_leituras").select("comunicado_id,user_id,created_at"),
      ]);
      if (posts.error) throw posts.error;
      if (reads.error) throw reads.error;
      return { posts: posts.data, reads: reads.data };
    },
  });
  const readByMe = (id: string) => data?.reads.find((r) => r.comunicado_id === id && r.user_id === me?.id);
  const pending = data?.posts.filter((p) => !p.arquivado && !p.resolvido && !readByMe(p.id)).length ?? 0;
  const posts = (data?.posts ?? []).filter((p) => {
    const matches = `${p.titulo} ${p.mensagem}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    if (!matches) return false;
    if (filter === "arquivados") return p.arquivado;
    if (p.arquivado) return false;
    if (filter === "pendentes") return !p.resolvido && !readByMe(p.id);
    if (filter === "resolvidos") return p.resolvido;
    return !p.resolvido;
  });

  async function confirm(id: string) {
    if (!me || busy) return;
    setBusy(id);
    const { error } = await supabase.from("comunicado_leituras").insert({ comunicado_id: id, user_id: me.id });
    setBusy(null);
    if (error && error.code !== "23505") { toast.error("Não foi possível confirmar a leitura."); return; }
    await qc.invalidateQueries({ queryKey: ["comunicados"] });
    toast.success("Leitura confirmada.");
  }

  async function archive(id: string) {
    if (busy || !window.confirm("Arquivar este comunicado? Ele deixará de aparecer para a equipe.")) return;
    setBusy(id);
    const { error } = await supabase.from("comunicados").update({ arquivado: true }).eq("id", id);
    setBusy(null);
    if (error) { toast.error("Não foi possível arquivar o comunicado."); return; }
    await qc.invalidateQueries({ queryKey: ["comunicados"] });
    toast.success("Comunicado arquivado.");
  }

  async function resolver(id: string) {
    if (busy || !window.confirm("Dar baixa neste comunicado? Ele será marcado como resolvido.")) return;
    setBusy(id);
    const { error } = await supabase.from("comunicados").update({ resolvido: true }).eq("id", id);
    setBusy(null);
    if (error) { toast.error("Não foi possível dar baixa no comunicado."); return; }
    await qc.invalidateQueries({ queryKey: ["comunicados"] });
    toast.success("Comunicado resolvido.");
  }

  return <div className="workspace">
    <PageHeader title="Comunicados" description="Administração · Grupo Confidence" actions={manage && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo comunicado</Button>} />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList><TabsTrigger value="ativos">Publicados</TabsTrigger><TabsTrigger value="pendentes">Não lidos ({pending})</TabsTrigger>{manage && <TabsTrigger value="resolvidos">Resolvidos</TabsTrigger>}{manage && <TabsTrigger value="arquivados">Arquivados</TabsTrigger>}</TabsList>
      </Tabs>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar comunicados" placeholder="Buscar comunicados" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    </div>
    {isPending ? <p className="text-sm text-muted-foreground">Carregando comunicados…</p> : isError ? <p role="alert" className="text-destructive">Não foi possível carregar os comunicados.</p> : posts.length === 0 ? <EmptyState text="Nenhum comunicado encontrado." /> : <div className="grid gap-4">
      {posts.map((p) => {
        const read = readByMe(p.id);
        return <article key={p.id} className="min-w-0 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3"><Megaphone className="mt-1 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{p.titulo}</h2><p className="mt-1 text-xs text-muted-foreground">Administração · {new Date(p.created_at).toLocaleString("pt-BR")}</p></div></div>
            <Badge variant="secondary">{p.arquivado ? "Arquivado" : p.resolvido ? "Resolvido" : read ? "Lido" : "Não lido"}</Badge>
          </div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{p.mensagem}</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="text-xs text-muted-foreground">{read ? `Leitura confirmada em ${new Date(read.created_at).toLocaleString("pt-BR")}` : "Leitura pendente"}{manage && <span className="ml-3">{data?.reads.filter((r) => r.comunicado_id === p.id).length ?? 0} leitura(s) confirmada(s)</span>}</div>
            <div className="flex gap-2">{!p.arquivado && !p.resolvido && !read && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => confirm(p.id)}><CheckCheck className="mr-2 h-4 w-4" />Confirmar leitura</Button>}{manage && !p.arquivado && !p.resolvido && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => resolver(p.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Dar baixa</Button>}{manage && !p.arquivado && <Button size="icon" variant="ghost" title="Arquivar comunicado" aria-label={`Arquivar ${p.titulo}`} disabled={busy !== null} onClick={() => archive(p.id)}><Archive className="h-4 w-4" /></Button>}</div>
          </div>
        </article>;
      })}
    </div>}
    {open && <NovoComunicado onClose={() => setOpen(false)} />}
  </div>;
}

function NovoComunicado({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !title.trim() || !message.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("comunicados").insert({ titulo: title.trim(), mensagem: message.trim() });
    setSaving(false);
    if (error) { toast.error("Não foi possível publicar o comunicado."); return; }
    await qc.invalidateQueries({ queryKey: ["comunicados"] });
    toast.success("Comunicado publicado.");
    onClose();
  }
  return <Dialog open onOpenChange={(value) => { if (!value && !saving) onClose(); }}>
    <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Novo comunicado</DialogTitle></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="comunicado-titulo">Título</Label><Input id="comunicado-titulo" required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="comunicado-mensagem">Mensagem</Label><Textarea id="comunicado-mensagem" required rows={7} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !title.trim() || !message.trim()}>{saving ? "Publicando…" : "Publicar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}