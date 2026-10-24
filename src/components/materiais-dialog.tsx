import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; nome: string };
type Props = { mode: "item" | "entrega" | "devolucao"; id?: string; minimumDate?: string; items: Option[]; people: (Option & { posto_id: string | null })[]; posts: Option[]; onClose: () => void };
export function MateriaisDialog({ mode, id, minimumDate, items, people, posts, onClose }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("equipamento");
  const [size, setSize] = useState("");
  const [identification, setIdentification] = useState("");
  const [item, setItem] = useState("");
  const [person, setPerson] = useState("");
  const [post, setPost] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [condition, setCondition] = useState("bom");
  const [notes, setNotes] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = mode === "item"
        ? await supabase.from("materiais").insert({ nome: name.trim(), categoria: category, tamanho: size.trim(), identificacao: identification.trim() }).select("id").single()
        : mode === "entrega"
          ? await supabase.from("material_entregas").insert({ material_id: item, colaborador_id: person, posto_id: post, quantidade: Number(quantity), data_entrega: date, observacoes: notes.trim() }).select("id").single()
          : await supabase.from("material_entregas").update({ data_devolucao: date, condicao_devolucao: condition }).eq("id", id ?? "").select("id").single();
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ["materiais"] });
      toast.success(mode === "item" ? "Material cadastrado." : mode === "entrega" ? "Entrega registrada." : "Devolução registrada.");
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar. Confira os dados e seu acesso."); }
    finally { setBusy(false); }
  }
  const selector = (label: string, value: string, change: (v: string) => void, options: Option[]) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{mode === "item" ? "Cadastrar material" : mode === "entrega" ? "Registrar entrega" : "Registrar devolução"}</DialogTitle><DialogDescription>Equipamentos e uniformes · Confidence</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      {mode === "item" ? <>
        <div className="space-y-2"><Label htmlFor="material-nome">Nome do material</Label><Input id="material-nome" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div>
        {selector("Categoria", category, setCategory, [{ id: "equipamento", nome: "Equipamento" }, { id: "uniforme", nome: "Uniforme" }])}
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="material-tamanho">Tamanho</Label><Input id="material-tamanho" value={size} onChange={(e) => setSize(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="material-identificacao">Identificação / patrimônio</Label><Input id="material-identificacao" value={identification} onChange={(e) => setIdentification(e.target.value)} /></div></div>
      </> : mode === "entrega" ? <>
        {selector("Material", item, setItem, items)}
        {selector("Colaborador", person, (v) => { setPerson(v); const p = people.find((c) => c.id === v)?.posto_id; if (p && posts.some((s) => s.id === p)) setPost(p); }, people)}
        {selector("Posto", post, setPost, posts)}
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="entrega-quantidade">Quantidade</Label><Input id="entrega-quantidade" type="number" required min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="entrega-data">Data da entrega</Label><Input id="entrega-data" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="entrega-notas">Observações</Label><Textarea id="entrega-notas" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </> : <>
        <div className="space-y-2"><Label htmlFor="devolucao-data">Data da devolução</Label><Input id="devolucao-data" type="date" required min={minimumDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {selector("Condição na devolução", condition, setCondition, [{ id: "bom", nome: "Bom estado" }, { id: "danificado", nome: "Danificado" }, { id: "inutilizado", nome: "Inutilizado" }])}
      </>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy || (mode === "item" ? !name.trim() : mode === "entrega" ? !item || !person || !post || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 : !date || date < (minimumDate ?? ""))}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}