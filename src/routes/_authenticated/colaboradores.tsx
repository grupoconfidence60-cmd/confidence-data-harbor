import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditColaboradores, SITUACAO_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — Grupo Confidence" }] }),
  component: () => <RequireModule module="colaboradores"><Colaboradores /></RequireModule>,
});

export type ColabForm = {
  id?: string; matricula: string; nome: string; cpf: string; telefone: string; email: string; endereco: string;
  funcao_id: string; posto_id: string; data_admissao: string; vinculo: string; jornada: string;
  situacao: keyof typeof SITUACAO_LABELS; observacoes: string;
};
const EMPTY: ColabForm = { matricula: "", nome: "", cpf: "", telefone: "", email: "", endereco: "", funcao_id: "", posto_id: "", data_admissao: "", vinculo: "CLT", jornada: "12x36", situacao: "ativo", observacoes: "" };

export function useLookups() {
  return useQuery({
    queryKey: ["lookups"],
    queryFn: async () => {
      const [{ data: funcoes }, { data: postos }] = await Promise.all([
        supabase.from("funcoes").select("id,nome").eq("ativo", true).order("nome"),
        supabase.from("postos").select("id,nome").eq("ativo", true).order("nome"),
      ]);
      return { funcoes: funcoes ?? [], postos: postos ?? [] };
    },
  });
}

function Colaboradores() {
  const { data: me } = useMe();
  const canEdit = canEditColaboradores(me?.roles ?? []);
  const [q, setQ] = useState("");
  const [sit, setSit] = useState("todos");
  const [posto, setPosto] = useState("todos");
  const [editing, setEditing] = useState<ColabForm | null>(null);
  const { data: lk } = useLookups();
  const { data: rows = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*, funcoes(nome), postos(nome)").eq("arquivado", false).order("nome");
      if (error) throw error;
      return data;
    },
  });
  const filtered = useMemo(() => rows.filter((r) =>
    (sit === "todos" || r.situacao === sit) && (posto === "todos" || r.posto_id === posto) &&
    (!q || [r.nome, r.matricula, r.cpf].some((v) => v?.toLowerCase().includes(q.toLowerCase())))), [rows, q, sit, posto]);

  return (
    <div>
      <PageHeader title="Colaboradores" description={`${rows.length} cadastrados`}
        actions={canEdit && <Button onClick={() => setEditing(EMPTY)}><Plus className="mr-1 h-4 w-4" />Novo colaborador</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, matrícula ou CPF" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={sit} onValueChange={setSit}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todas situações</SelectItem>
            {Object.entries(SITUACAO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={posto} onValueChange={setPosto}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos os postos</SelectItem>
            {lk?.postos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? <EmptyState text="Nenhum colaborador encontrado." /> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Matrícula</TableHead><TableHead>Nome</TableHead><TableHead>Função</TableHead><TableHead>Posto</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.matricula}</TableCell>
                  <TableCell><Link to="/colaborador/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.nome}</Link></TableCell>
                  <TableCell>{r.funcoes?.nome ?? "—"}</TableCell>
                  <TableCell>{r.postos?.nome ?? <span className="text-warning">Sem posto</span>}</TableCell>
                  <TableCell><SituacaoBadge s={r.situacao} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && <ColabDialog value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function SituacaoBadge({ s }: { s: keyof typeof SITUACAO_LABELS }) {
  const v = s === "ativo" ? "default" : s === "desligado" ? "destructive" : "secondary";
  return <Badge variant={v}>{SITUACAO_LABELS[s]}</Badge>;
}

export function ColabDialog({ value, onClose }: { value: ColabForm; onClose: () => void }) {
  const [f, setF] = useState<ColabForm>(value);
  const [saving, setSaving] = useState(false);
  const { data: lk } = useLookups();
  const qc = useQueryClient();
  const set = (k: keyof ColabForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      matricula: f.matricula.trim(), nome: f.nome.trim(), cpf: f.cpf.replace(/\D/g, "") || null,
      telefone: f.telefone || null, email: f.email || null, endereco: f.endereco || null,
      funcao_id: f.funcao_id || null, posto_id: f.posto_id || null, data_admissao: f.data_admissao || null,
      vinculo: f.vinculo || null, jornada: f.jornada || null, situacao: f.situacao, observacoes: f.observacoes || null,
    };
    if (payload.cpf && payload.cpf.length !== 11) { setSaving(false); return toast.error("CPF deve ter 11 dígitos."); }
    const { error } = f.id
      ? await supabase.from("colaboradores").update(payload).eq("id", f.id)
      : await supabase.from("colaboradores").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "Matrícula ou CPF já cadastrado." : error.message);
    toast.success("Colaborador salvo.");
    qc.invalidateQueries();
    onClose();
  }

  const field = (k: keyof ColabForm, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input value={f[k] as string} onChange={set(k)} {...props} /></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {field("nome", "Nome completo *", { required: true })}
          {field("matricula", "Matrícula *", { required: true })}
          {field("cpf", "CPF", { inputMode: "numeric" })}
          {field("telefone", "Telefone")}
          {field("email", "E-mail", { type: "email" })}
          {field("data_admissao", "Data de admissão", { type: "date" })}
          <div className="space-y-1.5"><Label>Função</Label>
            <Select value={f.funcao_id || "none"} onValueChange={(v) => setF({ ...f, funcao_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{lk?.funcoes.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Posto de trabalho</Label>
            <Select value={f.posto_id || "none"} onValueChange={(v) => setF({ ...f, posto_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem posto</SelectItem>{lk?.postos.map((x) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          {field("vinculo", "Vínculo contratual")}
          {field("jornada", "Escala / jornada")}
          <div className="space-y-1.5"><Label>Situação</Label>
            <Select value={f.situacao} onValueChange={(v) => setF({ ...f, situacao: v as ColabForm["situacao"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(SITUACAO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          {field("endereco", "Endereço")}
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações administrativas</Label><Textarea value={f.observacoes} onChange={set("observacoes")} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
