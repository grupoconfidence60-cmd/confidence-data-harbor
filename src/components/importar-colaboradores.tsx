import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ESCALA_OPTIONS } from "@/lib/escala-options";
import { baixarModeloImportacao, IMPORT_HEADERS, parseImport, type ImportRow } from "@/lib/importacao";

type Ref = { id: string; nome: string };
export function ImportarColaboradores({ funcoes, postos, existentes, onClose }: { funcoes: Ref[]; postos: Ref[]; existentes: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const validas = rows?.filter((r) => !r.erros.length) ?? [];
  async function ler(file: File) {
    try {
      const book = XLSX.read(await file.arrayBuffer());
      const sheet = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "" });
      const parsed = parseImport(sheet, { funcoes, postos, existentes, escalas: [...ESCALA_OPTIONS] });
      if (!parsed.length) toast.error("Nenhuma linha encontrada. Use o modelo com os cabeçalhos corretos.");
      setRows(parsed);
    } catch { toast.error("Não foi possível ler o arquivo. Envie uma planilha .xlsx ou .csv."); }
  }
  async function importar() {
    setBusy(true);
    const { error } = await supabase.from("colaboradores").insert(validas.map(({ linha: _l, erros: _e, ...r }) => ({ ...r, situacao: "ativo" as const })));
    setBusy(false);
    if (error) { toast.error(`Importação não concluída: ${error.message}`); return; }
    await qc.invalidateQueries({ queryKey: ["colaboradores"] });
    toast.success(`${validas.length} colaborador(es) importado(s).`);
    onClose();
  }
  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Importar colaboradores por planilha</DialogTitle><DialogDescription>Colunas: {IMPORT_HEADERS.join(", ")}. Só Matrícula e Nome são obrigatórios; função e posto devem ter o mesmo nome do cadastro.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" type="button" onClick={baixarModeloImportacao}><Download />Baixar modelo</Button>
      <Button asChild variant="outline"><label className="cursor-pointer"><Upload />Escolher planilha<input type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Arquivo da planilha" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(f); e.target.value = ""; }} /></label></Button>
    </div>
    {rows && rows.length > 0 && <>
      <p className="text-sm"><strong>{validas.length}</strong> prontas para importar · <strong className={rows.length - validas.length ? "text-destructive" : ""}>{rows.length - validas.length}</strong> com problema (serão ignoradas)</p>
      <div className="max-h-80 overflow-auto border"><table className="w-full text-sm"><thead><tr className="text-left">{["Linha", "Matrícula", "Nome", "Situação"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead><tbody>
        {rows.map((r) => <tr key={r.linha} className="border-t"><td className="px-2 py-1">{r.linha}</td><td className="px-2">{r.matricula}</td><td className="px-2">{r.nome}</td><td className={`px-2 ${r.erros.length ? "text-destructive" : "text-muted-foreground"}`}>{r.erros.length ? r.erros.join("; ") : "OK"}</td></tr>)}
      </tbody></table></div>
    </>}
    <DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={importar} disabled={busy || !validas.length}>{busy ? "Importando…" : `Importar ${validas.length || ""}`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
