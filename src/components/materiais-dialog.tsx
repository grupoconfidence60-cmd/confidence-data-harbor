import { RESERVA, destinoMaterial, postoEntrega } from "@/lib/material-reserva";
import { GRUPOS_ESTOQUE } from "@/lib/estoque";
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
import { tiposUniforme } from "@/components/material-tipos";
import { cadastrarTamanhosUniforme, ehUniforme, separarTamanhos, resumoTamanhos } from "@/lib/uniformes";

type Option = { id: string; nome: string };
type Props = { mode: "item" | "entrega" | "devolucao"; id?: string; minimumDate?: string; initialMaterialId?: string; items: Option[]; people: (Option & { posto_id: string | null })[]; posts: Option[]; onClose: () => void };
export function MateriaisDialog({ mode, id, minimumDate, initialMaterialId, items, people, posts, onClose }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("equipamento");
  const [grupo, setGrupo] = useState("Outros");
  const [uniformType, setUniformType] = useState("outro");
  const uniformPreset = tiposUniforme.find((t) => t.id === uniformType);
  const [size, setSize] = useState("");
  const [identification, setIdentification] = useState("");
  const [lines, setLines] = useState<{ item: string; quantity: string }[]>([{ item: initialMaterialId ?? "", quantity: "1" }]);
  const linesOk = lines.length > 0 && lines.every((l) => l.item && Number.isInteger(Number(l.quantity)) && Number(l.quantity) >= 1) && new Set(lines.map((l) => l.item)).size === lines.length;
  const setLine = (i: number, patch: Partial<{ item: string; quantity: string }>) => setLines((cur) => cur.map((l, j) => j === i ? { ...l, ...patch } : l));
  const [person, setPerson] = useState("");
  const [post, setPost] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [condition, setCondition] = useState("bom");
  const [notes, setNotes] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "item" && ehUniforme(category)) {
        const tamanhos = separarTamanhos(size);
        if (size.trim() && !tamanhos.length) throw new Error("Informe um tamanho válido ou deixe o campo vazio.");
        const result = await cadastrarTamanhosUniforme({
          nome: name.trim(),
          categoria: category,
          tamanhos: tamanhos.length ? tamanhos : [""],
          identificacao: identification.trim(),
        });
        await supabase.from("materiais").update({ grupo }).ilike("nome", name.trim()).eq("grupo", "");
        await qc.invalidateQueries({ queryKey: ["materiais"] });
        toast.success(resumoTamanhos(result));
        onClose();
        return;
      }
      const result = mode === "item"
        ? await supabase.from("materiais").insert({ nome: name.trim(), categoria: category, grupo, tamanho: size.trim(), identificacao: identification.trim() }).select("id").single()
        : mode === "entrega"
          ? await supabase.from("material_entregas").insert(lines.map((l) => ({ material_id: l.item, colaborador_id: person, posto_id: postoEntrega(post), quantidade: Number(l.quantity), data_entrega: date, observacoes: notes.trim() }))).select("id")
          : await supabase.from("material_entregas").update({ data_devolucao: date, condicao_devolucao: condition }).eq("id", id ?? "").select("id").single();
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ["materiais"] });
      toast.success(mode === "item" ? "Material cadastrado." : mode === "entrega" ? lines.length > 1 ? `${lines.length} materiais entregues.` : "Entrega registrada." : "Devolução registrada.");
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar. Confira os dados e seu acesso."); }
    finally { setBusy(false); }
  }
  const selector = (label: string, value: string, change: (v: string) => void, options: Option[]) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{mode === "item" ? "Cadastrar material" : mode === "entrega" ? "Registrar entrega" : "Registrar devolução"}</DialogTitle><DialogDescription>{mode === "item" ? "Escolha a categoria, informe o nome e depois os tamanhos. Quantidades são lançadas na aba Estoque." : mode === "entrega" ? "Selecione o colaborador uma vez e adicione todos os materiais que ele recebeu." : "Informe a data e a condição do material devolvido. A entrega original será preservada."}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      {mode === "item" ? <>
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground">1. Identifique o material</p>
          {selector("Categoria", category, (value) => { setCategory(value); setUniformType("outro"); setSize(""); }, [{ id: "equipamento", nome: "Equipamento" }, { id: "uniforme", nome: "Uniforme" }, { id: "escritorio", nome: "Material de escritório" }, { id: "manutencao", nome: "Manutenção eletrônica" }])}
          {selector("Grupo no estoque", grupo, setGrupo, GRUPOS_ESTOQUE.map((g) => ({ id: g, nome: g })))}
          {ehUniforme(category) && selector("Modelo de preenchimento (opcional)", uniformType, (value) => {
            setUniformType(value);
            const preset = tiposUniforme.find((t) => t.id === value);
            if (preset) setName(preset.nome);
            setSize("");
          }, [{ id: "outro", nome: "Informar o nome manualmente" }, ...tiposUniforme.map((t) => ({ id: t.id, nome: t.nome }))])}
          <div className="space-y-2"><Label htmlFor="material-nome">Nome do material</Label><Input id="material-nome" required maxLength={160} placeholder={ehUniforme(category) ? "Ex.: Calça de Vigia ou Calça de Vigilante" : "Informe o nome do equipamento"} value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">2. Informe os detalhes</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="material-tamanho">{ehUniforme(category) ? "Tamanhos" : "Tamanho"}</Label><Input id="material-tamanho" placeholder={ehUniforme(category) ? "Ex.: P, M, G ou 38, 40, 42" : "Informe se houver"} value={size} onChange={(e) => setSize(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="material-identificacao">Identificação / patrimônio</Label><Input id="material-identificacao" value={identification} onChange={(e) => setIdentification(e.target.value)} /></div>
        </div>
        {ehUniforme(category) && <div className="space-y-2">
          {uniformPreset && uniformPreset.tamanhos.length > 0 && <div className="flex flex-wrap gap-1" role="group" aria-label="Sugestões de tamanhos">
            {uniformPreset.tamanhos.map((value) => {
              const selected = separarTamanhos(size).includes(value);
              return <Button key={value} type="button" size="sm" variant={selected ? "default" : "outline"} aria-pressed={selected} onClick={() => setSize((current) => {
                const values = separarTamanhos(current);
                return (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]).join(", ");
              })}>{value}</Button>;
            })}
          </div>}
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground"><p>Separe os tamanhos por vírgula. Exemplo: 38, 40, 42.</p><p>Deixe vazio quando o tamanho não estiver informado. O cadastro não aumenta o estoque.</p><details className="pt-1"><summary className="cursor-pointer rounded font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Como os tamanhos são salvos?</summary><p className="mt-2">Cada nome e tamanho forma um registro separado. Equivalentes são reaproveitados e registros arquivados são reativados. Não há restrição por função do colaborador.</p></details></div>
        </div>}
      </> : mode === "entrega" ? <>
        {selector("Colaborador", person, (v) => { setPerson(v); setPost(destinoMaterial(people.find((c) => c.id === v)?.posto_id ?? null, posts)); }, people)}
        {selector("Posto / classificação", post, setPost, [...(people.find((c) => c.id === person)?.posto_id === null ? [{ id: RESERVA, nome: "Reserva · Sem posto" }] : []), ...posts])}
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold text-muted-foreground">Materiais entregues</p>
          {lines.map((l, i) => <div key={i} className="flex items-end gap-2"><div className="min-w-0 flex-1 space-y-1"><Label className="text-xs">Material {i + 1}</Label><Select value={l.item} onValueChange={(v) => setLine(i, { item: v })}><SelectTrigger className="w-full" aria-label={`Material ${i + 1}`}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{items.filter((o) => o.id === l.item || !lines.some((x) => x.item === o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div><div className="w-20 space-y-1"><Label className="text-xs">Qtd.</Label><Input type="number" aria-label={`Quantidade do material ${i + 1}`} min={1} step={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></div>{lines.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))}>Remover</Button>}</div>)}
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((cur) => [...cur, { item: "", quantity: "1" }])}>+ Adicionar outro material</Button>
        </div>
        <div className="grid grid-cols-1 gap-3"><div className="space-y-2"><Label htmlFor="entrega-data">Data da entrega</Label><Input id="entrega-data" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="entrega-notas">Observações</Label><Textarea id="entrega-notas" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </> : <>
        <div className="space-y-2"><Label htmlFor="devolucao-data">Data da devolução</Label><Input id="devolucao-data" type="date" required min={minimumDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {selector("Condição na devolução", condition, setCondition, [{ id: "bom", nome: "Bom estado" }, { id: "danificado", nome: "Danificado" }, { id: "inutilizado", nome: "Inutilizado" }])}
      </>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy || (mode === "item" ? !name.trim() : mode === "entrega" ? !linesOk || !person || !post : !date || date < (minimumDate ?? ""))}>{busy ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}