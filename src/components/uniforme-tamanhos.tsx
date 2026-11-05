import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cadastrarTamanhosUniforme, separarTamanhos, resumoTamanhos } from "@/lib/uniformes";

type Item = { nome: string; categoria: string; tamanho: string; identificacao?: string };

export function UniformeTamanhos({ item, label, nomeExibicao }: { item: Item; label?: string; nomeExibicao?: string }) {
  const nomeVisivel = nomeExibicao ?? item.nome;
  const qc = useQueryClient();
  const inputId = useId();
  const saving = useRef(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const tamanhos = separarTamanhos(text);

  async function save() {
    if (saving.current || !tamanhos.length) return;
    saving.current = true;
    setBusy(true);
    try {
      const result = await cadastrarTamanhosUniforme({
        nome: item.nome,
        categoria: item.categoria,
        identificacao: item.identificacao,
        tamanhos,
      });
      await qc.invalidateQueries({ queryKey: ["materiais"] });
      toast.success(resumoTamanhos(result));
      setOpen(false);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar os tamanhos.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Popover open={open} onOpenChange={(value) => {
    if (saving.current) return;
    if (value) setText("");
    setOpen(value);
  }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="my-1 h-auto min-h-7 gap-2 px-2 py-1 text-xs" aria-label={`Adicionar tamanhos de ${nomeVisivel}`}>
        {label ?? (item.tamanho || "Sem tamanho")}<Plus className="h-3 w-3" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3 bg-popover text-popover-foreground">
      <div><p className="text-sm font-semibold">Adicionar tamanhos</p><p className="break-words text-xs text-muted-foreground">{nomeVisivel}</p></div>
      <div className="space-y-2"><Label htmlFor={inputId}>Tamanhos</Label><Textarea id={inputId} value={text} disabled={busy} placeholder="Ex.: P, M, G ou 38, 40, 42" onChange={(e) => setText(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">Separe por vírgula, ponto e vírgula ou linha. Cada tamanho será um registro separado, sem alterar os tamanhos, saldos e entregas anteriores. Equivalentes existentes serão reaproveitados; arquivados serão reativados.</p>
      {tamanhos.length > 0 && <p className="break-words text-xs text-foreground">{tamanhos.length} tamanho(s): {tamanhos.join(", ")}</p>}
      <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" size="sm" disabled={busy || !tamanhos.length} onClick={save}>{busy ? "Salvando…" : "Adicionar"}</Button></div>
    </PopoverContent>
  </Popover>;
}
