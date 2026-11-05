import { useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/page";
import { MaterialTamanho } from "@/components/material-tamanho";
import { UniformeTamanhos } from "@/components/uniforme-tamanhos";
import { ehUniforme, normalizarUniforme } from "@/lib/uniformes";
import { MOV_LABELS, saldo, pendentes, precisaComprar, CATEGORIA_LABELS, GRUPOS_ESTOQUE, type Mov } from "@/lib/estoque";

type Opt = { id: string; nome: string };
type Item = Opt & { tamanho: string; categoria: string; identificacao?: string; grupo?: string; estoque_minimo?: number };
const grupoDe = (i: Item) => i.grupo?.trim() || "Outros";
const catLabel = (c: string) => CATEGORIA_LABELS[c] ?? c;
type Person = Opt & { matricula: string; posto_id: string | null };

function chaveMaterial(item: Item) {
  return JSON.stringify([grupoDe(item), ehUniforme(item.categoria) ? "uniforme" : normalizarUniforme(item.categoria), normalizarUniforme(item.nome)]);
}

const movQuery = queryOptions({
  queryKey: ["materiais", "movimentacoes"],
  queryFn: async () => {
    const [m, p] = await Promise.all([
      supabase.from("material_movimentacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,nome").eq("status", "ativo").order("nome"),
    ]);
    if (m.error) throw m.error;
    return { movs: m.data ?? [], profiles: p.data ?? [] };
  },
});

export function MaterialEstoque({ items, people, posts, canFull, filterMaterialIds, canEditSizes = false }: { items: Item[]; people: Person[]; posts: Opt[]; canFull: boolean; filterMaterialIds?: string[]; canEditSizes?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery(movQuery);
  const movs = data?.movs ?? [];
  const profiles = data?.profiles ?? [];
  const [open, setOpen] = useState(false);
  const [initialMaterialId, setInitialMaterialId] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [soComprar, setSoComprar] = useState(false);
  function abrirMovimentacao(id = "") {
    setInitialMaterialId(id);
    setOpen(true);
  }
  const [fPost, setFPost] = useState("todos");
  const [fPerson, setFPerson] = useState("todos");
  const [fSup, setFSup] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const comprarItem = (i: Item) => precisaComprar(saldo(movs, i.id), i.estoque_minimo ?? 0);
  const paraComprar = items.filter(comprarItem);
  const gruposDisponiveis = [...new Set(items.map(grupoDe))].sort((a, b) => (GRUPOS_ESTOQUE.indexOf(a) + 99) % 99 - (GRUPOS_ESTOQUE.indexOf(b) + 99) % 99 || a.localeCompare(b));
  const grupos = new Map<string, Item[]>();
  for (const item of [...items].sort((a, b) => gruposDisponiveis.indexOf(grupoDe(a)) - gruposDisponiveis.indexOf(grupoDe(b)))) {
    if (categoria !== "todos" && grupoDe(item) !== categoria) continue;
    if (soComprar && !comprarItem(item)) continue;
    const key = chaveMaterial(item);
    const grupo = grupos.get(key) ?? [];
    grupo.push(item);
    grupos.set(key, grupo);
  }
  const name = (list: Opt[], id: string | null) => (id ? list.find((x) => x.id === id)?.nome ?? "—" : "—");
  const day = (iso: string) => iso.slice(0, 10);
  const hist = movs.filter((m) => (!filterMaterialIds || filterMaterialIds.includes(m.material_id)) && (fPost === "todos" || m.posto_id === fPost) && (fPerson === "todos" || m.colaborador_id === fPerson) && (fSup === "todos" || m.supervisor_id === fSup) && (!from || day(m.created_at) >= from) && (!to || day(m.created_at) <= to));
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  async function excluir(m: (typeof movs)[number]) {
    const desc = `${MOV_LABELS[m.tipo]} · ${name(items, m.material_id)} · ${m.quantidade} un. · ${fmt(m.created_at)}`;
    if (!window.confirm(`Excluir esta movimentação do histórico?\n\n${desc}\n\nO estoque será recalculado sem este lançamento.`)) return;
    const { error } = await supabase.from("material_movimentacoes").delete().eq("id", m.id);
    if (error) { toast.error("Não foi possível excluir. Confira seu acesso."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Movimentação excluída do histórico.");
  }

  function exportar() {
    const book = XLSX.utils.book_new();
    const est = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Estoque"], ["Grupo", "Material", "Categoria", "Tamanho", "Em estoque", "Estoque mínimo", "Situação", "Entregues pendentes"], ...[...items].sort((a, b) => gruposDisponiveis.indexOf(grupoDe(a)) - gruposDisponiveis.indexOf(grupoDe(b)) || a.nome.localeCompare(b.nome) || a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true })).map((i) => [grupoDe(i), i.nome, catLabel(i.categoria), i.tamanho, saldo(movs, i.id), i.estoque_minimo ?? 0, comprarItem(i) ? "Comprar" : "Ok", pendentes(movs, i.id)])]);
    est["!cols"] = [24, 34, 22, 14, 12, 14, 12, 18].map((wch) => ({ wch }));
    const mov = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Movimentações"], ["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por", "Motivo"], ...hist.map((m) => [fmt(m.created_at), MOV_LABELS[m.tipo], name(items, m.material_id), m.quantidade, name(people, m.colaborador_id), name(posts, m.posto_id), name(profiles, m.supervisor_id), name(profiles, m.registrado_por), m.motivo])]);
    XLSX.utils.book_append_sheet(book, est, "Estoque");
    XLSX.utils.book_append_sheet(book, mov, "Movimentações");
    XLSX.writeFile(book, "Confidence-Estoque-Materiais.xlsx");
  }

  const sel = (label: string, v: string, set: (v: string) => void, opts: Opt[], all: string) => <Select value={v} onValueChange={set}><SelectTrigger className="w-full sm:w-52" aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">{all}</SelectItem>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select>;

  return <div className="space-y-4 text-foreground">
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Saldo por material">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-base font-semibold">Consultar estoque</h3><p className="mt-1 text-xs text-muted-foreground">Escolha o tamanho e veja as quantidades. Para lançar uma entrada ou saída, use Movimentar na linha.</p></div>
        <div className="flex shrink-0 flex-wrap gap-2"><Button onClick={() => abrirMovimentacao()} disabled={!items.length}><Plus />Novo lançamento</Button><Button variant="outline" onClick={exportar}><Download />Exportar</Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar grupo do estoque">
          {[{ id: "todos", nome: "Todos" }, ...gruposDisponiveis.map((g) => ({ id: g, nome: g }))].map((opcao) => <Button key={opcao.id} type="button" size="sm" variant={categoria === opcao.id ? "secondary" : "ghost"} aria-pressed={categoria === opcao.id} onClick={() => setCategoria(opcao.id)}>{opcao.nome}</Button>)}
        </div>
        <div className="flex items-center gap-3"><Button type="button" size="sm" variant={soComprar ? "destructive" : "outline"} aria-pressed={soComprar} onClick={() => setSoComprar((v) => !v)}>Precisa comprar ({paraComprar.length})</Button><span className="text-xs text-muted-foreground">{grupos.size} material(is)</span></div>
      </div>
      {!grupos.size ? <EmptyState text="Nenhum material encontrado. Ajuste a busca ou a categoria." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr>{["Material", "Tamanho", "Disponível", "Situação", "A devolver", "Ação"].map((h) => <th key={h} className="px-4 text-left">{h}</th>)}</tr></thead><tbody>{[...grupos.entries()].map(([key, grupo], idx, all) => <EstoqueGrupo key={key} first={idx === 0 || grupoDe(all[idx - 1][1][0]) !== grupoDe(grupo[0])} items={grupo} movs={movs} canEditSizes={canEditSizes} onMovimentar={abrirMovimentacao} />)}</tbody></table></div>}
      <p className="border-t bg-muted/10 px-4 py-3 text-xs text-muted-foreground">As quantidades correspondem ao tamanho selecionado. O cadastro de tamanhos não acrescenta unidades ao estoque.</p>
    </section>
    <details className="rounded-lg border bg-card p-4">
      <summary className="cursor-pointer rounded text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Histórico de movimentações <span className="ml-2 font-normal text-muted-foreground">({hist.length})</span></summary>
      <p className="mb-3 mt-2 text-xs text-muted-foreground">Consulte os lançamentos de estoque usando os filtros abaixo. A busca acima filtra somente o quadro de saldos; este histórico possui filtros próprios.</p>
      <div className="mb-3 flex flex-wrap gap-3">{sel("Filtrar posto", fPost, setFPost, posts, "Todos os postos")}{sel("Filtrar colaborador", fPerson, setFPerson, people, "Todos os colaboradores")}{sel("Filtrar supervisor", fSup, setFSup, profiles, "Todos os supervisores")}<Input type="date" aria-label="De" className="w-full sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" aria-label="Até" className="w-full sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {!hist.length ? <EmptyState text="Nenhuma movimentação encontrada." /> : <div className="overflow-x-auto border bg-card"><table className="w-full min-w-[900px]"><thead><tr>{["Data/hora", "Tipo", "Material", "Qtd.", "Colaborador", "Posto", "Supervisor", "Lançado por", ...(canFull ? ["Ações"] : [])].map((h) => <th key={h} className="px-3 text-left">{h}</th>)}</tr></thead><tbody>{hist.map((m) => <tr key={m.id} className="border-t"><td className="px-3 py-2 whitespace-nowrap">{fmt(m.created_at)}</td><td className="px-3"><Badge variant="outline">{MOV_LABELS[m.tipo]}</Badge>{m.motivo && <p className="text-xs text-muted-foreground">{m.motivo}</p>}</td><td className="px-3">{name(items, m.material_id)}</td><td className="px-3">{m.quantidade}</td><td className="px-3">{name(people, m.colaborador_id)}</td><td className="px-3">{name(posts, m.posto_id)}</td><td className="px-3">{name(profiles, m.supervisor_id)}</td><td className="px-3">{name(profiles, m.registrado_por)}</td>{canFull && <td className="px-3"><Button variant="ghost" size="icon" aria-label="Excluir movimentação" onClick={() => excluir(m)}><Trash2 className="text-destructive" /></Button></td>}</tr>)}</tbody></table></div>}
    </details>
    {open && <MovDialog items={items} people={people} posts={posts} profiles={profiles} canFull={canFull} initialMaterialId={initialMaterialId} onClose={() => setOpen(false)} />}
  </div>;
}

function EstoqueGrupo({ first, ...props }: { first: boolean; items: Item[]; movs: Mov[]; canEditSizes: boolean; onMovimentar: (id: string) => void }) {
  return <>{first && <tr className="bg-muted/40"><td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">{grupoDe(props.items[0])}</td></tr>}<EstoqueLinha {...props} /></>;
}

function MinimoInput({ item }: { item: Item }) {
  const qc = useQueryClient();
  const [v, setV] = useState(String(item.estoque_minimo ?? 0));
  async function salvar() {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (n === (item.estoque_minimo ?? 0)) return;
    const { error } = await supabase.from("materiais").update({ estoque_minimo: n }).eq("id", item.id);
    if (error) { toast.error("Não foi possível salvar o estoque mínimo."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Estoque mínimo atualizado.");
  }
  return <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">Mínimo<Input type="number" min={0} className="h-7 w-16 px-2 text-xs" value={v} onChange={(e) => setV(e.target.value)} onBlur={salvar} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></label>;
}

function EstoqueLinha({ items, movs, canEditSizes, onMovimentar }: { items: Item[]; movs: Mov[]; canEditSizes: boolean; onMovimentar: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const item = items[0];
  const uniforme = ehUniforme(item.categoria);
  const tamanhos = new Map<string, Item[]>();
  for (const registro of items) {
    const key = normalizarUniforme(registro.tamanho);
    const grupo = tamanhos.get(key) ?? [];
    grupo.push(registro);
    tamanhos.set(key, grupo);
  }
  const opcoes = [...tamanhos.values()].sort((a, b) => a[0].tamanho.localeCompare(b[0].tamanho, "pt-BR", { numeric: true }));
  const selecionados = opcoes.find((grupo) => grupo[0].id === selectedId) ?? opcoes[0];
  const selecionado = selecionados[0];
  const emEstoque = selecionados.reduce((total, registro) => total + saldo(movs, registro.id), 0);
  const aDevolver = selecionados.reduce((total, registro) => total + pendentes(movs, registro.id), 0);

  return <tr className="border-t text-foreground">
    <td className="px-4 py-3 align-top"><p className="font-semibold">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{catLabel(item.categoria)}</p></td>
    <td className="px-4 py-3 align-top">
      <Select value={selecionado.id} onValueChange={setSelectedId}>
        <SelectTrigger className="w-44 bg-background" aria-label={`Selecionar tamanho de ${item.nome}`}><SelectValue /></SelectTrigger>
        <SelectContent>{opcoes.map((grupo) => <SelectItem key={grupo[0].id} value={grupo[0].id}>{grupo[0].tamanho.trim() || "Sem tamanho informado"}</SelectItem>)}</SelectContent>
      </Select>
      {canEditSizes && <details className="mt-2 text-xs"><summary className="w-fit cursor-pointer rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Gerenciar tamanhos</summary><div className="mt-2">{uniforme ? <UniformeTamanhos item={selecionado} label="Adicionar tamanhos" /> : <MaterialTamanho key={selecionado.id} item={selecionado} />}</div></details>}
    </td>
    <td className="px-4 py-3 align-top"><p className={`text-lg font-semibold tabular-nums ${emEstoque < 0 ? "text-destructive" : "text-foreground"}`}>{emEstoque}<span className="ml-1 text-xs font-normal text-muted-foreground">un.</span></p><p className="text-xs text-muted-foreground">{emEstoque > 0 ? "Em estoque" : emEstoque === 0 ? "Sem estoque" : "Saldo negativo"}</p></td>
    <td className="px-4 py-3 align-top">{precisaComprar(emEstoque, selecionado.estoque_minimo ?? 0) ? <Badge variant="destructive">Comprar</Badge> : <Badge variant="secondary">Ok</Badge>}<p className="mt-1 text-xs text-muted-foreground">Mínimo: {selecionado.estoque_minimo ?? 0}</p>{canEditSizes && <MinimoInput key={selecionado.id} item={selecionado} />}</td>
    <td className="px-4 py-3 align-top"><p className="text-lg font-semibold tabular-nums">{aDevolver}<span className="ml-1 text-xs font-normal text-muted-foreground">un.</span></p></td>
    <td className="px-4 py-3 align-top"><Button type="button" size="sm" variant="outline" aria-label={`Movimentar ${item.nome}, ${selecionado.tamanho || "sem tamanho"}`} onClick={() => onMovimentar(selecionado.id)}><Plus className="h-4 w-4" />Movimentar</Button></td>
  </tr>;
}

function MovDialog({ items, people, posts, profiles, canFull, initialMaterialId, onClose }: { items: Item[]; people: Person[]; posts: Opt[]; profiles: Opt[]; canFull: boolean; initialMaterialId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(canFull ? "entrada" : "entrega");
  const [item, setItem] = useState(initialMaterialId);
  const grupos = new Map<string, Item[]>();
  for (const registro of items) {
    const chave = chaveMaterial(registro);
    const grupo = grupos.get(chave) ?? [];
    grupo.push(registro);
    grupos.set(chave, grupo);
  }
  const selecionado = items.find((registro) => registro.id === item);
  const grupoSelecionado = selecionado ? chaveMaterial(selecionado) : "";
  const variacoes = [...(grupos.get(grupoSelecionado) ?? [])].sort((a, b) => a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }));
  const [qtd, setQtd] = useState("1");
  const [person, setPerson] = useState("");
  const [post, setPost] = useState("");
  const [sup, setSup] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const needsPerson = ["entrega", "devolucao", "troca"].includes(tipo);
  const tipos = Object.entries(MOV_LABELS).filter(([k]) => canFull || !["entrada", "baixa"].includes(k)).map(([id, nome]) => ({ id, nome }));
  const ok = item && Number.isInteger(Number(qtd)) && Number(qtd) > 0 && (!needsPerson || (person && post));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    const { error } = await supabase.from("material_movimentacoes").insert({ tipo, material_id: item, quantidade: Number(qtd), colaborador_id: needsPerson ? person : null, posto_id: post || null, supervisor_id: sup || null, motivo: motivo.trim() });
    setBusy(false);
    if (error) { toast.error(error.message.includes("Estoque insuficiente") ? "Estoque insuficiente para este material." : "Não foi possível registrar. Confira os dados e seu acesso."); return; }
    await qc.invalidateQueries({ queryKey: ["materiais"] });
    toast.success("Movimentação registrada.");
    onClose();
  }
  const s = (label: string, v: string, set: (v: string) => void, opts: Opt[]) => <div className="space-y-2"><Label>{label}</Label><Select value={v} onValueChange={set}><SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Nova movimentação</DialogTitle><DialogDescription>O lançamento fica registrado com seu nome, data e horário.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      {s("Tipo de movimentação", tipo, setTipo, tipos)}
      <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
        {s("Material", grupoSelecionado, (chave) => setItem(grupos.get(chave)?.[0].id ?? ""), [...grupos.entries()].map(([chave, grupo]) => ({ id: chave, nome: `${grupo[0].nome} · ${grupoDe(grupo[0])}` })))}
        {selecionado ? s("Tamanho / identificação", item, setItem, variacoes.map((registro) => ({ id: registro.id, nome: `${registro.tamanho.trim() || "Sem tamanho informado"}${registro.identificacao ? ` · ${registro.identificacao}` : ""}` }))) : <p className="text-xs text-muted-foreground">Escolha o material para visualizar seus tamanhos cadastrados.</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="mov-qtd">Quantidade de unidades</Label><Input id="mov-qtd" type="number" min={1} step={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
      {needsPerson && s("Colaborador", person, (v) => { setPerson(v); const p = people.find((c) => c.id === v)?.posto_id; if (p && posts.some((x) => x.id === p)) setPost(p); }, people.map((p) => ({ id: p.id, nome: `${p.matricula} · ${p.nome}` })))}
      {s(needsPerson ? "Posto" : "Posto (opcional)", post, setPost, posts)}
      {s("Supervisor que autorizou", sup, setSup, profiles)}
      <div className="space-y-2"><Label htmlFor="mov-motivo">Motivo / observações</Label><Textarea id="mov-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={!ok || busy}>{busy ? "Salvando…" : "Registrar"}</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}
