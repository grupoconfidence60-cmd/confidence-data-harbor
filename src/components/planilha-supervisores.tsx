import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SupervisoresEscala = { impar: string; par: string };
const EMPTY: SupervisoresEscala = { impar: "", par: "" };

export function useSupervisoresEscala(scope: string) {
  const storageKey = `confidence:supervisores-escala:${scope}`;
  const [saved, setSaved] = useState<SupervisoresEscala>(EMPTY);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setLoadedKey(null);
    setStorageError(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (value && typeof value === "object" && "impar" in value && "par" in value && typeof value.impar === "string" && typeof value.par === "string") {
        setSaved({ impar: value.impar, par: value.par });
      } else {
        setSaved(EMPTY);
      }
    } catch {
      setSaved(EMPTY);
      setStorageError(true);
    }
    setLoadedKey(storageKey);
  }, [storageKey]);

  function save(value: SupervisoresEscala) {
    if (loadedKey !== storageKey) return;
    const next = { impar: value.impar.trim(), par: value.par.trim() };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
      setStorageError(false);
      toast.success("Supervisores salvos neste navegador.");
    } catch {
      setStorageError(true);
      toast.error("Não foi possível salvar os supervisores neste navegador.");
    }
  }

  return { saved, save, ready: loadedKey === storageKey, storageError };
}

export function PlanilhaSupervisores({ saved, save, ready, storageError, filter, onFilterChange, busy }: {
  saved: SupervisoresEscala;
  save: (value: SupervisoresEscala) => void;
  ready: boolean;
  storageError: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(saved);
  useEffect(() => { setDraft(saved); }, [saved]);
  const names = Array.from(new Set([saved.impar, saved.par, "Janilson"].filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const options = Array.from(new Set([...names, draft.impar.trim(), draft.par.trim()].filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const changed = draft.impar.trim() !== saved.impar || draft.par.trim() !== saved.par;

  return <section className="mb-5 rounded-lg border bg-card p-4 text-card-foreground" aria-label="Supervisores das escalas">
    <h3 className="text-sm font-semibold">Supervisores · Par e Ímpar</h3>
    <p className="mt-1 text-xs text-muted-foreground">Informe os nomes dos responsáveis deste mês. Salvos somente neste navegador; não alteram permissões de acesso e não são incluídos no Excel.</p>
    <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(["impar", "par"] as const).map((type) => (
        <div key={type} className="space-y-2">
          <Label htmlFor={`supervisor-escala-${type}-selecao`}>Supervisor da escala {type === "impar" ? "Ímpar" : "Par"}</Label>
          <Select value={draft[type].trim() ? `nome:${draft[type].trim()}` : "sem-supervisor"} disabled={!ready || busy} onValueChange={(value) => setDraft((prev) => ({ ...prev, [type]: value === "sem-supervisor" ? "" : value.slice(5) }))}>
            <SelectTrigger id={`supervisor-escala-${type}-selecao`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem-supervisor">Sem supervisor definido</SelectItem>
              {options.map((name) => <SelectItem key={name} value={`nome:${name}`}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button type="button" disabled={!ready || busy || !changed} onClick={() => { save(draft); onFilterChange("todos"); }}>Salvar supervisores</Button>
      <div className="space-y-2"><Label htmlFor="supervisor-escala-filtro">Filtrar por supervisor</Label><Select value={filter} disabled={!ready || busy} onValueChange={onFilterChange}><SelectTrigger id="supervisor-escala-filtro" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os supervisores</SelectItem><SelectItem value="sem-supervisor">Sem supervisor definido</SelectItem>{names.map((name) => <SelectItem key={name} value={`nome:${name}`}>{name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {storageError && <p role="alert" className="mt-3 text-sm text-destructive">O armazenamento local não está disponível ou os dados salvos não puderam ser lidos.</p>}
    {changed && <p role="status" className="mt-3 text-xs text-muted-foreground">Há alterações de supervisão ainda não salvas.</p>}
    {filter !== "todos" && <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onFilterChange("todos")}>Limpar filtro de supervisor</Button>}
  </section>;
}
