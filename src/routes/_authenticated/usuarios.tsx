import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type PasswordUser = { id: string; nome: string; email: string };

function Usuarios() {
  const qc = useQueryClient();
  const update = useServerFn(updateUserAccess);
  const [creating, setCreating] = useState(false);
  const [passwordUser, setPasswordUser] = useState<PasswordUser | null>(null);
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
              <TableCell>
                <Button size="sm" variant="ghost" aria-label={`Redefinir senha de ${u.nome}`} onClick={() => setPasswordUser({ id: u.id, nome: u.nome, email: u.email })}>
                  <KeyRound className="mr-1 h-4 w-4" />Senha
                </Button>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {passwordUser && <PasswordDialog key={passwordUser.id} user={passwordUser} onClose={() => setPasswordUser(null)} />}
      <div className="mt-3 text-xs text-muted-foreground"><Badge variant="outline">Dica</Badge> Contas inativas ou bloqueadas não conseguem entrar no sistema.</div>
    </div>
  );
}

function PasswordDialog({ user, onClose }: { user: PasswordUser; onClose: () => void }) {
  const reset = useServerFn(resetUserPassword);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < 8) {
      setFormError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setFormError("As senhas digitadas não são iguais.");
      return;
    }
    setSaving(true);
    try {
      const res = await reset({ data: { userId: user.id, password } });
      if (!res.ok) {
        setFormError(res.error || "Não foi possível redefinir a senha. Tente novamente.");
        return;
      }
      toast.success(`Senha de ${user.nome} redefinida. A nova senha já pode ser usada.`);
      onClose();
    } catch (err) {
      setFormError((err as Error).message || "Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>Defina a nova senha de acesso de {user.nome} ({user.email}).</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Nova senha</Label>
            <PasswordInput id="new-user-password" required minLength={8} maxLength={72} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Use de 8 a 72 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-user-password">Repita a nova senha</Label>
            <PasswordInput id="confirm-user-password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          {formError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar nova senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
          <div className="space-y-1.5"><Label>Senha inicial</Label><PasswordInput minLength={8} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
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
