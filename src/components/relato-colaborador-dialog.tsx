import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function AttachmentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return <div className="min-w-0 flex-1 space-y-2">
    {url ? <img src={url} alt={`Prévia de ${file.name}`} className="max-h-48 w-full rounded-md bg-muted object-contain" /> : <FileText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
    <p className="break-words text-sm font-medium">{file.name}</p>
    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB · Não enviado</p>
  </div>;
}

export function RelatoColaboradorDialog({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState("relato");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setError("");
    if (!selected.length) return;
    if (files.length + selected.length > MAX_FILES) {
      setError("Selecione no máximo 3 anexos. Remova um arquivo antes de adicionar outro.");
      return;
    }
    if (selected.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setError("Use fotos JPG, PNG ou WebP, ou um atestado em PDF.");
      return;
    }
    if (selected.some((file) => file.size === 0 || file.size > MAX_BYTES)) {
      setError("Cada arquivo deve ter conteúdo e no máximo 10 MB.");
      return;
    }
    setFiles((current) => [...current, ...selected]);
  }

  function close() {
    if ((message.trim() || files.length > 0) && !window.confirm("Descartar este relato e os anexos selecionados? Nada foi enviado ou salvo.")) return;
    onClose();
  }

  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto bg-background text-foreground">
      <DialogHeader>
        <DialogTitle>Preparar relato ou atestado</DialogTitle>
        <DialogDescription>Descreva sua situação e selecione fotos ou um atestado, sem publicá-los no mural de comunicados.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground" id="relato-envio-aviso">
          O envio ainda não está habilitado. O texto e os anexos ficam somente nesta tela e serão descartados ao fechá-la. Nenhum responsável receberá este conteúdo nesta etapa; para assuntos urgentes, utilize o canal habitual da empresa.
        </div>
        <div className="space-y-2">
          <Label htmlFor="relato-tipo">Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="relato-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relato">Relato com foto</SelectItem>
              <SelectItem value="atestado">Atestado</SelectItem>
              <SelectItem value="outro">Outro assunto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="relato-descricao">Descrição</Label>
          <Textarea id="relato-descricao" rows={5} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={type === "atestado" ? "Informe o período do afastamento e as informações necessárias, sem detalhar seu diagnóstico." : "Conte o que aconteceu…"} />
          <p className="text-right text-xs text-muted-foreground">{message.length}/5000</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="relato-anexos" className="flex items-center gap-2"><Paperclip className="h-4 w-4" aria-hidden="true" />Fotos ou atestado</Label>
          <Input id="relato-anexos" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={selectFiles} aria-describedby="relato-anexos-ajuda relato-anexos-erro" />
          <p id="relato-anexos-ajuda" className="text-xs text-muted-foreground">Até 3 arquivos de 10 MB cada. Fotos JPG, PNG, WebP ou PDF. No celular, selecione uma foto ou use a câmera, quando disponível.</p>
          <p id="relato-anexos-erro" role="alert" className="text-sm text-destructive">{error}</p>
        </div>
        {files.length > 0 && <ul className="grid gap-3" aria-label="Anexos selecionados">
          {files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <AttachmentPreview file={file} />
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Remover ${file.name}`} onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); setError(""); }}><Trash2 className="h-4 w-4" /></Button>
          </li>)}
        </ul>}
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={close}>Fechar</Button>
        <Button type="button" disabled aria-describedby="relato-envio-aviso">Envio ainda não habilitado</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
