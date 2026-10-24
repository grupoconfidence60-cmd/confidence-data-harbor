import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule } from "@/components/page";
import { ROLE_LABELS, STATUS_LABELS, type AppRole } from "@/lib/labels";
import { createUser, updateUserAccess, resetUserPassword } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [
    { title: "Usuários e acessos — Grupo Confidence" },
    { name: "description", content: "Administração de contas e acessos ao Grupo Confidence." },
    { property: "og:title", content: "Usuários e acessos — Grupo Confidence" },
    { property: "og:description", content: "Administração de contas e acessos ao Grupo Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="usuarios"><Usuarios /></RequireModule>,
});

function Usuarios() {
  const qc = useQueryClient();
  const update = useServerFn(updateUserAccess);
  const reset = useServerFn(resetUserPassword);
  const [creating, setCreating] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((x) => ({ ...x, role: (r ?? []).find((y) => y.user_id === x.id)?.role as AppRole | undefined }));
    },
  });

  async function change(userId: string, patch: { role?: AppRole; status?: "ativo" | "inativo" | "bloqueado" }) {
    const res = await update({ data: { userId, ...patch } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Acesso atualizado."); qc.invalidateQueries();
  }
  async function resetPw(userId: string) {
    const pw = prompt("Nova senha (mínimo 8 caracteres):");
    if (!pw) return;
    if (pw.length < 8) { toast.error("Senha muito curta."); return; }
    const res = await reset({ data: { userId, password: pw } });
    res.ok ? toast.success("Senha redefinida.") : toast.error(res.error);
  }

  return (
    <div>
      <PageHeader title="Usuários e acessos" description="Somente a administração cria contas e define permissões"
        actions={<Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Novo usuário</Button>} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead>Último acesso</TableHead><TableHead>Criado em</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{data.map((u) => (
            <TableRow key={u.id}>
              <TableCell><div className="font-medium">{u.nome}</div><div className="text-xs text-muted-foreground">{u.email}{u.cargo ? ` · ${u.cargo}` : ""}</div></TableCell>
              <TableCell>
                <Select value={u.role ?? "none"} onValueChange={(v) => change(u.id, { role: v as AppRole })}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Sem perfil" /></SelectTrigger>
                  <SelectContent>{u.role ? null : <SelectItem value="none" disabled>Sem perfil</SelectItem>}
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={u.status} onValueChange={(v) => change(u.id, { status: v as "ativo" })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm">{u.last_access ? new Date(u.last_access).toLocaleString("pt-BR") : "—"}</TableCell>
              <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={() => resetPw(u.id)}><KeyRound className="mr-1 h-4 w-4" />Senha</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      <p className="mt-3 text-xs text-muted-foreground"><Badge variant="outline">Dica</Badge> Contas inativas ou bloqueadas não conseguem entrar no sistema.</p>
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const create = useServerFn(createUser);
  const qc = useQueryClient();
  const [f, setF] = useState({ nome: "", email: "", password: "", cargo: "", role: "colaborador" as AppRole });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await create({ data: f });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Usuário criado. Informe a senha inicial ao colaborador.");
      qc.invalidateQueries(); onClose();
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5"><Label>Nome completo</Label><Input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Senha inicial</Label><Input type="text" minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Cargo</Label><Input value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Perfil de acesso</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar usuário"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
