import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ComunicadoOpcoes = {
  audience: string;
  recipients: string;
  scheduledAt: string;
  files: File[];
};

const EXTENSIONS = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|txt)$/i;
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return <div className="min-w-0 flex-1 space-y-2 text-foreground">
    {url ? <img src={url} alt={`Prévia de ${file.name}`} className="max-h-40 w-full rounded-md bg-muted object-contain" /> : <FileText aria-hidden="true" className="h-7 w-7 text-muted-foreground" />}
    <p className="break-words text-sm font-medium">{file.name}</p>
    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB · Não enviado</p>
  </div>;
}

export function ComunicadoDetalhes({ value, onChange }: { value: ComunicadoOpcoes; onChange: (value: ComunicadoOpcoes) => void }) {
  const [error, setError] = useState("");

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setError("");
    if (!selected.length) return;
    if (value.files.length + selected.length > MAX_FILES) {
      setError("Adicione no máximo 5 arquivos por comunicado.");
      return;
    }
    if (selected.some((file) => !EXTENSIONS.test(file.name))) {
      setError("Selecione fotos JPG, PNG ou WebP, arquivos PDF, Word, Excel ou TXT.");
      return;
    }
    if (selected.some((file) => file.size === 0 || file.size > MAX_BYTES)) {
      setError("Cada arquivo deve ter conteúdo e no máximo 10 MB.");
      return;
    }
    onChange({ ...value, files: [...value.files, ...selected] });
  }

  return <section aria-label="Destinatários, horário e anexos" className="space-y-4 rounded-lg border bg-card p-4 text-foreground">
    <div className="space-y-2">
      <Label htmlFor="comunicado-destino">Para quem vai?</Label>
      <Select value={value.audience} onValueChange={(audience) => onChange({ ...value, audience, recipients: "" })}>
        <SelectTrigger id="comunicado-destino"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os colaboradores</SelectItem>
          <SelectItem value="posto">Colaboradores de um posto</SelectItem>
          <SelectItem value="especificos">Colaboradores específicos</SelectItem>
        </SelectContent>
      </Select>
      {value.audience !== "todos" && <div className="space-y-2">
        <Label htmlFor="comunicado-destinatarios">{value.audience === "posto" ? "Nome do posto" : "Nomes dos destinatários"}</Label>
        <Input id="comunicado-destinatarios" required maxLength={1000} value={value.recipients} onChange={(event) => onChange({ ...value, recipients: event.target.value })} placeholder={value.audience === "posto" ? "Informe o posto" : "Informe os nomes separados por vírgula"} aria-describedby="comunicado-destino-ajuda" />
        <p id="comunicado-destino-ajuda" className="text-xs text-muted-foreground">Indicação para preparar o comunicado; os nomes ainda não estão vinculados a contas e não definem acesso ao mural.</p>
      </div>}
    </div>
    <div className="space-y-2">
      <Label htmlFor="comunicado-horario">Data e horário desejados para envio</Label>
      <Input id="comunicado-horario" type="datetime-local" value={value.scheduledAt} onChange={(event) => onChange({ ...value, scheduledAt: event.target.value })} aria-describedby="comunicado-horario-ajuda" />
      <p id="comunicado-horario-ajuda" className="text-xs text-muted-foreground">Horário local. Deixe vazio para publicação imediata. Preencher este campo não agenda um envio automático nesta etapa.</p>
      {value.scheduledAt && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, scheduledAt: "" })}>Limpar data e horário</Button>}
    </div>
    <div className="space-y-2">
      <Label htmlFor="comunicado-anexos" className="flex items-center gap-2"><Paperclip className="h-4 w-4" aria-hidden="true" />Fotos ou anexos de arquivos</Label>
      <Input id="comunicado-anexos" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={selectFiles} aria-describedby="comunicado-anexos-ajuda comunicado-anexos-erro" />
      <p id="comunicado-anexos-ajuda" className="text-xs text-muted-foreground">Até 5 arquivos, com no máximo 10 MB cada. JPG, PNG, WebP, PDF, Word, Excel ou TXT. A seleção não envia os arquivos.</p>
      <p id="comunicado-anexos-erro" role="alert" className="text-sm text-destructive">{error}</p>
    </div>
    {value.files.length > 0 && <ul aria-label="Anexos selecionados" className="grid gap-3">
      {value.files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-start gap-3 rounded-md border bg-background p-3">
        <FilePreview file={file} />
        <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Remover ${file.name}`} onClick={() => { onChange({ ...value, files: value.files.filter((_, i) => i !== index) }); setError(""); }}><Trash2 className="h-4 w-4" /></Button>
      </li>)}
    </ul>}
  </section>;
}
