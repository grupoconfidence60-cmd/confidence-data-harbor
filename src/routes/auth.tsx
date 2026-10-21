import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Grupo Confidence" },
      { name: "description", content: "Acesso seguro ao sistema de gestão operacional do Grupo Confidence." },
      { property: "og:title", content: "Entrar — Grupo Confidence" },
      { property: "og:description", content: "Acesso restrito a usuários autorizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", password: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
    supabase.rpc("system_initialized").then(({ data }) => setInitialized(!!data));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Se o e-mail estiver cadastrado, você receberá um link de redefinição.");
        setMode("login");
      } else if (initialized === false) {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { nome: form.nome } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel" });
        else toast.success("Conta de administrador criada. Confirme pelo link enviado ao seu e-mail.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw new Error("E-mail ou senha inválidos, ou conta bloqueada.");
        navigate({ to: "/painel" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const setup = initialized === false && mode === "login";

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand p-10 text-primary-foreground md:flex">
        <BrandMark />
        <div>
          <h2 className="text-3xl font-semibold">Segurança, organização e controle.</h2>
          <p className="mt-3 max-w-sm opacity-75">Acesso individual e permissões por perfil. Todas as ações ficam registradas.</p>
        </div>
        <p className="text-xs opacity-50">© Grupo Confidence</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="md:hidden"><BrandMark /></div>
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "reset" ? "Redefinir senha" : setup ? "Configuração inicial" : "Entrar"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "reset"
                ? "Informe seu e-mail para receber o link."
                : setup
                  ? "Crie a conta do Administrador geral. Depois, novos usuários só poderão ser criados por ele."
                  : "Use as credenciais fornecidas pela administração."}
            </p>
          </div>
          {setup && (
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={8} autoComplete={setup ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading || initialized === null}>
            {loading ? "Aguarde..." : mode === "reset" ? "Enviar link" : setup ? "Criar administrador" : "Entrar"}
          </Button>
          {!setup && (
            <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "login" ? "reset" : "login")}>
              {mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
