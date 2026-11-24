import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Grupo Confidence" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Nova senha — Grupo Confidence" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < 8 || password.length > 72) {
      setFormError("A nova senha precisa ter de 8 a 72 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setFormError("As senhas digitadas não são iguais.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        ...(currentPassword ? { current_password: currentPassword } : {}),
      });
      if (error) {
        setFormError(error.code === "current_password_required"
          ? "Informe sua senha atual para confirmar a alteração."
          : "Não foi possível salvar a senha. Se você usou um link de recuperação, solicite um novo e tente novamente.");
        return;
      }
      toast.success("Senha atualizada. A nova senha já pode ser usada.");
      navigate({ to: "/painel" });
    } catch {
      setFormError("Não foi possível salvar a senha. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold">Definir nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Preencha e repita a senha que você usará para entrar.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <PasswordInput id="new-password" minLength={8} maxLength={72} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">Use de 8 a 72 caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">Repita a nova senha</Label>
          <PasswordInput id="confirm-new-password" minLength={8} maxLength={72} required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </div>
        {formError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
        <Button className="w-full" type="submit" disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
