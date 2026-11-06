import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Trash2, FileText, FileWarning, Paperclip, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditDocumentos, DOCUMENTO_TIPOS } from "@/lib/labels";
import { anexarJustificativa, TAMANHO_MAXIMO_ANEXO } from "@/lib/falta-justificada";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [
    { title: "Documentos — Grupo Confidence" },
    { name: "description", content: "Documentos privados, justificativas de falta e pendências de anexo da equipe Confidence." },
    { property: "og:title", content: "Documentos — Grupo Confidence" },
    { property: "og:description", content: "Documentos privados, justificativas de falta e pendências de anexo da equipe Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="documentos"><Documentos /></RequireModule>,
});

type Pendencia = {
  id: string;
  colaborador_id: string;
  data: string;
  justificativa: string | null;
  cobertura_colaborador_id: string | null;
};

const dataBr = (data: string) => new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");

function Documentos() {
  const { data: me } = useMe();
  const canEdit = canEditDocumentos(me?.roles ?? []);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroVenc, setFiltroVenc] = useState("todos");
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const [docsResult, colabsResult, presResult] = await Promise.all([
        supabase.from("documentos").select("*").order("created_at", { ascending: false }),
        supabase.from("colaboradores").select("id, nome, matricula").order("nome"),
        supabase.from("presencas").select("id, colaborador_id, data, justificativa, cobertura_colaborador_id").eq("status", "falta_justificada").order("data", { ascending: false }),
      ]);
      if (docsResult.error) throw docsResult.error;
      if (colabsResult.error) throw colabsResult.error;
      if (presResult.error) throw presResult.error;
      return { docs: docsResult.data ?? [], colabs: colabsResult.data ?? [], pres: presResult.data ?? [] };
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
  const pendencias = (data?.pres ?? []).filter((p) => !(data?.docs ?? []).some((d) => d.presenca_id === p.id));
  const nomeColab = (id: string | null) => id ? data?.colabs.find((c) => c.id === id)?.nome ?? "—" : "Não informada";

  async function baixar(path: string, nome: string) {
    const { data: signed, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (error || !signed) { toast.error("Não foi possível abrir o documento."); return; }
    const a = document.createElement("a");
    a.href = signed.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.click();
  }

  async function excluir(id: string, path: string) {
    if (!window.confirm("Excluir este documento definitivamente?")) return;
    const { error } = await supabase.from("documentos").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir. Se a falta estiver confirmada, retire a confirmação antes."); return; }
    await supabase.storage.from("documentos").remove([path]);
    toast.success("Documento excluído.");
    qc.invalidateQueries({ queryKey: ["documentos"] });
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  if (isPending) return <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground" role="status">Carregando documentos...</div>;
  if (error) return <div className="space-y-3 rounded-lg border bg-card p-6 text-center" role="alert"><p>Não foi possível carregar os documentos.</p><Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div>;

  return (
    <div>
      <PageHeader title="Documentos" description="Atestados, justificativas, certificados e arquivos dos colaboradores"
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Enviar documento</Button>} />
      <Tabs defaultValue="documentos" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="documentos">Todos os documentos ({data?.docs.length ?? 0})</TabsTrigger>
          <TabsTrigger value="pendencias" className="gap-2"><FileWarning className="h-4 w-4" />Pendências de anexo ({pendencias.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filtroColab} onValueChange={setFiltroColab}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os colaboradores</SelectItem>
                {(data?.colabs ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
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
                          {d.presenca_id && <Badge variant="secondary">Vinculado à presença</Badge>}
                          {situacaoVenc(d.data_vencimento) === "vencido" && <Badge variant="destructive">Vencido</Badge>}
                          {situacaoVenc(d.data_vencimento) === "vencendo" && <Badge>A vencer</Badge>}
                        </div>
                        <div className="mt-1 truncate text-sm text-muted-foreground">
                          {nomeColab(d.colaborador_id)} · {d.arquivo_nome} · {new Date(d.created_at).toLocaleString("pt-BR")}
                          {d.data_vencimento && ` · Vence em ${dataBr(d.data_vencimento)}`}
                        </div>
                        {d.observacao && <p className="mt-1 text-sm">{d.observacao}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => baixar(d.arquivo_path, d.arquivo_nome)}><Download className="mr-1 h-4 w-4" />Baixar</Button>
                      {canEdit && <Button size="sm" variant="ghost" onClick={() => excluir(d.id, d.arquivo_path)} aria-label={`Excluir ${d.titulo}`}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pendencias" className="space-y-4">
          <p className="text-sm text-muted-foreground">Toda falta justificada precisa de um comprovante. Enquanto o anexo não for enviado, a Administração e o RH não conseguem confirmar o lançamento.</p>
          {pendencias.length === 0 ? <EmptyState text="Nenhuma falta justificada aguardando anexo." /> : (
            <div className="grid gap-3">{pendencias.map((p) => (
              <Card key={p.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{nomeColab(p.colaborador_id)}</span><Badge variant="destructive">Anexo obrigatório</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">Falta justificada de {dataBr(p.data)}</p>
                  {p.justificativa && <p className="mt-2 text-sm">{p.justificativa}</p>}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><UserRoundCheck className="h-4 w-4" />Cobertura: {nomeColab(p.cobertura_colaborador_id)}</p>
                </div>
                <Button onClick={() => setPendencia(p)}><Paperclip />Anexar justificativa</Button>
              </CardContent></Card>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>
      {open && <UploadDialog colabs={data?.colabs ?? []} onClose={() => setOpen(false)} />}
      {pendencia && <UploadDialog colabs={data?.colabs ?? []} pendencia={pendencia} onClose={() => setPendencia(null)} />}
    </div>
  );
}

function UploadDialog({ colabs, pendencia, onClose }: {
  colabs: { id: string; nome: string }[];
  pendencia?: Pendencia;
  onClose: () => void;
}) {
  const [colaboradorId, setColaboradorId] = useState(pendencia?.colaborador_id ?? "");
  const [tipo, setTipo] = useState<string>(pendencia ? "Justificativa de falta" : DOCUMENTO_TIPOS[0] ?? "Outro");
  const [titulo, setTitulo] = useState(pendencia ? `Justificativa de falta — ${dataBr(pendencia.data)}` : "");
  const [observacao, setObservacao] = useState(pendencia?.justificativa ?? "");
  const [vencimento, setVencimento] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) { toast.error("Selecione um arquivo."); return; }
    if (arquivo.size > TAMANHO_MAXIMO_ANEXO) { toast.error("Arquivo maior que 20 MB."); return; }
    setEnviando(true);
    if (pendencia) {
      const resultado = await anexarJustificativa({
        presencaId: pendencia.id,
        colaboradorId: pendencia.colaborador_id,
        data: pendencia.data,
        justificativa: observacao,
        arquivo,
      });
      setEnviando(false);
      if (resultado.error) { toast.error(resultado.error); return; }
    } else {
      const path = `${colaboradorId}/${crypto.randomUUID()}-${arquivo.name}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, arquivo);
      if (upErr) { setEnviando(false); toast.error("Não foi possível enviar o arquivo."); return; }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("documentos").insert({
        colaborador_id: colaboradorId, tipo, titulo: titulo.trim(), arquivo_path: path,
        arquivo_nome: arquivo.name, observacao: observacao || null, enviado_por: userData.user?.id ?? null,
        data_vencimento: vencimento || null,
      });
      if (error) {
        await supabase.storage.from("documentos").remove([path]);
        setEnviando(false);
        toast.error("Não foi possível salvar o documento.");
        return;
      }
      setEnviando(false);
    }
    toast.success(pendencia ? "Justificativa anexada e pendência concluída." : "Documento enviado.");
    qc.invalidateQueries({ queryKey: ["documentos"] });
    qc.invalidateQueries({ queryKey: ["presencas"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{pendencia ? "Anexar justificativa de falta" : "Enviar documento"}</DialogTitle>
          {pendencia && <DialogDescription>{nomeColabLocal(colabs, pendencia.colaborador_id)} · falta de {dataBr(pendencia.data)}. Depois do anexo, o lançamento poderá ser confirmado.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId} required disabled={Boolean(pendencia)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={Boolean(pendencia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOCUMENTO_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Título *</Label><Input required value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={Boolean(pendencia)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Arquivo * (máx. 20 MB)</Label>
            <Input ref={fileRef} type="file" required accept={pendencia ? ".pdf,image/*" : undefined} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          {!pendencia && <div className="space-y-1.5"><Label>Data de vencimento (se houver)</Label><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label>{pendencia ? "Motivo da falta *" : "Observação"}</Label><Textarea required={Boolean(pendencia)} maxLength={pendencia ? 2000 : undefined} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" disabled={enviando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando || !colaboradorId}>{enviando ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function nomeColabLocal(colabs: { id: string; nome: string }[], id: string) {
  return colabs.find((c) => c.id === id)?.nome ?? "Colaborador";
}
