import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tiposUniforme, tipoUniforme } from "@/components/material-tipos";

export function MaterialTamanho({ item }: { item: { id: string; nome: string; tamanho: string; categoria: string } }) {
  const qc = useQueryClient();
  const inputId = useId();
  const saving = useRef(false);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(item.tamanho);
  const [busy, setBusy] = useState(false);
  const preset = item.categoria === "uniforme" ? tiposUniforme.find((t) => t.id === tipoUniforme(item.nome)) : undefined;
  const sizes = [...new Set([...(preset?.tamanhos ?? []), item.tamanho.trim()].filter(Boolean))];

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.from("materiais")
        .update({ tamanho: size.trim() })
        .eq("id", item.id)
        .eq("arquivado", false)
        .select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["materiais"] });
      toast.success("Tamanho atualizado.");
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar o tamanho. Confira seu acesso e tente novamente.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Popover open={open} onOpenChange={(value) => {
    if (saving.current) return;
    if (value) setSize(item.tamanho);
    setOpen(value);
  }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="my-1 h-7 gap-2 px-2 text-xs" aria-label={`Editar tamanho de ${item.nome}`}>
        {item.tamanho || "Sem tamanho"}<Pencil className="h-3 w-3" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-64 space-y-3 bg-popover text-popover-foreground">
      <div><p className="text-sm font-semibold">Editar tamanho</p><p className="break-words text-xs text-muted-foreground">{item.nome}</p></div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Opções de tamanho">
        {sizes.map((value) => <Button key={value} type="button" size="sm" variant={size === value ? "default" : "outline"} className="h-7 px-2 text-xs" disabled={busy} aria-pressed={size === value} onClick={() => setSize(value)}>{value}</Button>)}
        <Button type="button" size="sm" variant={!size ? "default" : "outline"} className="h-7 px-2 text-xs" disabled={busy} aria-pressed={!size} onClick={() => setSize("")}>Sem tamanho</Button>
      </div>
      <div className="space-y-1"><Label htmlFor={inputId}>Tamanho</Label><Input id={inputId} className="h-8" value={size} disabled={busy} placeholder="Digite para editar" onChange={(e) => setSize(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">Altera o tamanho deste material no cadastro, não a quantidade em estoque.</p>
      <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" size="sm" disabled={busy || size.trim() === item.tamanho} onClick={save}>{busy ? "Salvando…" : "Salvar"}</Button></div>
    </PopoverContent>
  </Popover>;
}
