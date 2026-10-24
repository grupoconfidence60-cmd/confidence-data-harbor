import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Trash2, FileText } from "lucide-react";
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
import { canEditDocumentos, DOCUMENTO_TIPOS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos — Grupo Confidence" }] }),
  component: () => <RequireModule module="documentos"><Documentos /></RequireModule>,
});

function Documentos() {
  const { data: me } = useMe();
  const roles = me?.roles ?? [];
  const canEdit = canEditDocumentos(roles);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroVenc, setFiltroVenc] = useState("todos");
  const { data } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const [{ data: docs }, { data: colabs }] = await Promise.all([
        supabase.from("documentos").select("*").order("created_at", { ascending: false }),
        supabase.from("colaboradores").select("id, nome").eq("arquivado", false).order("nome"),
      ]);
      return { docs: docs ?? [], colabs: colabs ?? [] };
    },
  });
  const hoje = new Date().toISOString().slice(0, 10);
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const situacaoVenc = (v: string | null) => (!v ? "sem" : v < hoje ? "vencido" : v <= em30 ? "vencendo" : "ok");
  const lista = (data?.docs ?? []).filter(
    (d) =>
      (filtroColab === "todos" || d.colaborador_id === filtroColab) &&
      (filtroTipo === "todos" || d.tipo === filtroTipo) &&
      (filtroVenc === "todos" || situacaoVenc(d.data_vencimento) === filtroVenc),
  );
  const nomeColab = (id: string) => data?.colabs.find((c) => c.id === id)?.nome ?? "—";

  async function baixar(path: string, nome: string) {
    const { data: signed, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (error || !signed) { toast.error(error?.message ?? "Falha ao gerar link."); return; }
    const a = document.createElement("a");
    a.href = signed.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.click();
  }

  async function excluir(id: string, path: string) {
    if (!window.confirm("Excluir este documento definitivamente?")) return;
    const { error } = await supabase.from("documentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from("documentos").remove([path]);
    toast.success("Documento excluído.");
    qc.invalidateQueries({ queryKey: ["documentos"] });
  }

  return (
    <div>
      <PageHeader title="Documentos" description="Atestados, contratos e arquivos dos colaboradores"
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Enviar documento</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={filtroColab} onValueChange={setFiltroColab}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os colaboradores</SelectItem>
            {(data?.colabs ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {DOCUMENTO_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroVenc} onValueChange={setFiltroVenc}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Vencimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Vencimento: todos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="vencendo">Vencendo em 30 dias</SelectItem>
            <SelectItem value="ok">Em dia</SelectItem>
            <SelectItem value="sem">Sem vencimento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {lista.length === 0 ? <EmptyState text="Nenhum documento encontrado." /> : (
        <div className="grid gap-3">
          {lista.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.titulo}</span>
                      <Badge variant="outline">{d.tipo}</Badge>
                      {situacaoVenc(d.data_vencimento) === "vencido" && <Badge variant="destructive">Vencido</Badge>}
                      {situacaoVenc(d.data_vencimento) === "vencendo" && <Badge>A vencer</Badge>}
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">
                      {nomeColab(d.colaborador_id)} · {d.arquivo_nome} · {new Date(d.created_at).toLocaleString("pt-BR")}
                      {d.data_vencimento && ` · Vence em ${new Date(d.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}`}
                    </div>
                    {d.observacao && <p className="mt-1 text-sm">{d.observacao}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => baixar(d.arquivo_path, d.arquivo_nome)}>
                    <Download className="mr-1 h-4 w-4" />Baixar
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => excluir(d.id, d.arquivo_path)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {open && <UploadDialog colabs={data?.colabs ?? []} onClose={() => setOpen(false)} />}
    </div>
  );
}

function UploadDialog({ colabs, onClose }: { colabs: { id: string; nome: string }[]; onClose: () => void }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState<string>(DOCUMENTO_TIPOS[0] ?? "Outro");
  const [titulo, setTitulo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) { toast.error("Selecione um arquivo."); return; }
    if (arquivo.size > 20 * 1024 * 1024) { toast.error("Arquivo maior que 20 MB."); return; }
    setEnviando(true);
    const path = `${colaboradorId}/${crypto.randomUUID()}-${arquivo.name}`;
    const { error: upErr } = await supabase.storage.from("documentos").upload(path, arquivo);
    if (upErr) { setEnviando(false); toast.error(upErr.message); return; }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("documentos").insert({
      colaborador_id: colaboradorId, tipo, titulo: titulo.trim(), arquivo_path: path,
      arquivo_nome: arquivo.name, observacao: observacao || null, enviado_por: userData.user?.id ?? null,
      data_vencimento: vencimento || null,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento enviado.");
    qc.invalidateQueries({ queryKey: ["documentos"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Enviar documento</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId} required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENTO_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Título *</Label><Input required value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Arquivo * (máx. 20 MB)</Label>
            <Input ref={fileRef} type="file" required onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label>Data de vencimento (se houver)</Label>
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Observação</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !colaboradorId}>{enviando ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
