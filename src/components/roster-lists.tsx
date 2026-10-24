import { FuncaoBadge } from "@/components/funcao-badge";
import { FUNCAO_BORDA, funcaoTom } from "@/lib/funcao-cores";
import { useState } from "react";
import { ArrowLeftRight, GripVertical, Moon, Pencil, Plus, Save, Sun, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rosterGroup, type PlanilhaPerson, type PlanilhaRow } from "@/lib/planilha";
import { escalaLabel } from "@/lib/escala-options";
import logoAsset from "@/assets/logo-confidence.png.asset.json";

export type RosterEdit = { posicao?: string; hora_inicio?: string; hora_fim?: string; removido?: boolean; escala_tipo?: string; paridade?: string; turno?: string };
type Props = {
  post: string; rows: PlanilhaRow[]; people: PlanilhaPerson[]; busy: boolean;
  save: (id: string, payload: RosterEdit) => Promise<boolean>;
  move: (id: string, type: "par" | "impar", turno: "diurno" | "noturno") => void;
  add: (type: "par" | "impar", turno: "diurno" | "noturno") => void;
  edit: (row: PlanilhaRow) => void;
};
export function RosterLists(props: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const { rows, post, busy } = props;
  return <div className="roster-lists">
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {(["impar", "par"] as const).map((type) => <section key={type} className="min-w-0" aria-label={`Planilha ${type === "par" ? "Par" : "Ímpar"}`}>
        <div className="flex min-h-16 items-center gap-3 border border-primary bg-primary px-4 py-3 text-primary-foreground">
          <img src={logoAsset.url} alt="Grupo Confidence" className="h-10 w-10 shrink-0 bg-card object-contain p-1" />
          <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold uppercase">{post} · {type === "par" ? "Par" : "Ímpar"}</h3><span className="text-xs opacity-80">{rows.filter((r) => rosterGroup(r) === type).length} colaboradores</span></div>
        </div>
        {(["diurno", "noturno"] as const).map((turno) => {
          const list = rows.filter((r) => rosterGroup(r) === type && r.turno === turno);
          const zone = `${type}-${turno}`;
          return <div key={turno} className={`border-x border-b ${over === zone ? "bg-accent ring-2 ring-inset ring-primary" : "bg-card"}`}
            onDragOver={(e) => { if (dragged && !busy) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(zone); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("application/confidence-person"); if (id && rows.some((r) => r.id === id) && !busy) props.move(id, type, turno); setDragged(null); setOver(null); }}>
            <div className="flex items-center justify-between gap-2 border-b bg-muted px-3 py-2"><span className="flex items-center gap-2 text-xs font-semibold uppercase">{turno === "diurno" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{turno}</span><Button size="icon" variant="ghost" disabled={busy} aria-label={`Incluir colaborador ${type} ${turno}`} title="Incluir colaborador" onClick={() => props.add(type, turno)}><Plus /></Button></div>
            <div className="overflow-x-auto"><table className="w-full table-fixed"><thead><tr><th className="w-16 px-2 text-left">Mat.</th><th className="w-[30%] px-2 text-left">Nome</th><th className="px-2 text-left">Posição</th><th className="w-28 px-2 text-left">Horário</th><th className="w-20"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{list.map((row) => <RosterLine key={`${row.id}-${row.posicao}-${row.hora_inicio}-${row.hora_fim}`} row={row} person={props.people.find((p) => p.id === row.colaborador_id)} props={props} dragged={dragged === row.id} onDrag={(e) => { e.dataTransfer.setData("application/confidence-person", row.id); e.dataTransfer.effectAllowed = "move"; setDragged(row.id); }} onEnd={() => { setDragged(null); setOver(null); }} />)}</tbody></table></div>
            {list.length === 0 && <div className="flex min-h-24 items-center justify-center px-4 text-xs text-muted-foreground">Nenhum colaborador</div>}
          </div>;
        })}
      </section>)}
    </div>
    {rows.some((r) => rosterGroup(r) === "outras") && <section className="mt-6"><h3 className="mb-3 text-sm font-semibold">Outras escalas</h3><div className="overflow-x-auto border bg-card"><table className="w-full"><thead><tr><th className="px-3 text-left">Mat.</th><th className="px-3 text-left">Nome</th><th className="px-3 text-left">Posição</th><th className="px-3 text-left">Escala / turno</th><th className="px-3 text-left">Horário</th><th>Ações</th></tr></thead><tbody>{rows.filter((r) => rosterGroup(r) === "outras").map((r) => { const person = props.people.find((p) => p.id === r.colaborador_id); return <tr key={r.id} className="border-t"><td className="px-3">{person?.matricula}</td><td className="px-3">{person?.nome} <FuncaoBadge nome={person?.funcoes?.nome} /></td><td className="px-3">{r.posicao || "—"}</td><td className="px-3">{escalaLabel(r.escala_tipo ?? r.paridade)} · {r.turno}</td><td className="px-3">{r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)}</td><td><Button size="icon" variant="ghost" title="Editar escala" aria-label={`Editar escala de ${person?.nome}`} onClick={() => props.edit(r)}><Pencil /></Button><Button size="icon" variant="ghost" title="Retirar da planilha" aria-label={`Retirar ${person?.nome}`} onClick={() => { if (window.confirm(`Retirar ${person?.nome} desta planilha?`)) void props.save(r.id, { removido: true }); }}><UserMinus /></Button></td></tr>; })}</tbody></table></div></section>}
  </div>;
}
function RosterLine({ row, person, props, dragged, onDrag, onEnd }: { row: PlanilhaRow; person: PlanilhaPerson | undefined; props: Props; dragged: boolean; onDrag: (e: React.DragEvent) => void; onEnd: () => void }) {
  const [draft, setDraft] = useState({ posicao: row.posicao ?? "", hora_inicio: row.hora_inicio.slice(0, 5), hora_fim: row.hora_fim.slice(0, 5) });
  const [editing, setEditing] = useState(false);
  const name = person?.nome ?? "Colaborador indisponível";
  return <tr className={`border-t ${FUNCAO_BORDA[funcaoTom(person?.funcoes?.nome)]} ${dragged ? "opacity-40" : "hover:bg-accent/40"}`}>
    <td className="px-2"><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="h-7 w-5 shrink-0 cursor-grab" disabled={props.busy} draggable={!props.busy} onDragStart={onDrag} onDragEnd={onEnd} title={`Arrastar ${name}`} aria-label={`Arrastar ${name}`}><GripVertical /></Button><span className="break-all text-[11px]">{person?.matricula ?? "—"}</span></div></td>
    <td className="px-2"><span className="block break-words text-xs font-semibold uppercase">{name}</span>{person?.funcoes?.nome && <FuncaoBadge nome={person.funcoes.nome} className="mt-0.5" />}</td>
    <td className="px-2">{editing ? <Input aria-label={`Posição de ${name}`} className="h-8 text-xs" value={draft.posicao} disabled={props.busy} onChange={(e) => setDraft({ ...draft, posicao: e.target.value })} /> : <span className="block break-words text-xs uppercase">{row.posicao || "—"}</span>}</td>
    <td className="px-2">{editing ? <div className="space-y-1"><Input type="time" aria-label={`Entrada de ${name}`} className="h-7 px-1 text-xs" value={draft.hora_inicio} onChange={(e) => setDraft({ ...draft, hora_inicio: e.target.value })} /><Input type="time" aria-label={`Saída de ${name}`} className="h-7 px-1 text-xs" value={draft.hora_fim} onChange={(e) => setDraft({ ...draft, hora_fim: e.target.value })} /></div> : <span className="text-[11px]">{row.hora_inicio.slice(0, 5)} às {row.hora_fim.slice(0, 5)}</span>}</td>
    <td className="px-1"><div className="flex flex-wrap gap-0.5">
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={props.busy || (editing && (!draft.hora_inicio || !draft.hora_fim))} title={editing ? "Salvar linha" : "Editar linha"} aria-label={`${editing ? "Salvar" : "Editar"} linha de ${name}`} onClick={async () => { if (!editing) setEditing(true); else if (await props.save(row.id, draft)) setEditing(false); }}>{editing ? <Save /> : <Pencil />}</Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={props.busy} title="Retirar da planilha" aria-label={`Retirar ${name}`} onClick={() => { if (window.confirm(`Retirar ${name} desta planilha?`)) void props.save(row.id, { removido: true }); }}><UserMinus /></Button>
      <Select value={`${rosterGroup(row)}-${row.turno}`} disabled={props.busy} onValueChange={(v) => { const [type, turno] = v.split("-"); if ((type === "impar" || type === "par") && (turno === "diurno" || turno === "noturno")) props.move(row.id, type, turno); }}><SelectTrigger className="h-7 w-14 gap-0 px-1" aria-label={`Mover ${name}`} title="Mover colaborador"><ArrowLeftRight className="h-3 w-3" /></SelectTrigger><SelectContent>{(["impar", "par"] as const).flatMap((t) => (["diurno", "noturno"] as const).map((s) => <SelectItem key={`${t}-${s}`} value={`${t}-${s}`}>{t === "par" ? "Par" : "Ímpar"} · {s === "diurno" ? "Diurno" : "Noturno"}</SelectItem>))}</SelectContent></Select>
    </div></td>
  </tr>;
}