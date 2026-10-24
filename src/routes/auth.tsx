import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Fingerprint, Activity, Lock } from "lucide-react";
import logo from "@/assets/logo-confidence-transparente.png";

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
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <div className="auth-panel relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-primary-foreground md:flex">
        <div className="auth-grid pointer-events-none absolute inset-0" />
        <div className="auth-scan pointer-events-none absolute inset-x-0 h-24" />
        <div className="relative font-display text-sm font-semibold tracking-[0.25em] opacity-90">GRUPO CONFIDENCE</div>
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <div className="auth-ring absolute -inset-10 rounded-full border border-primary-foreground/20" />
            <div className="auth-ring-2 absolute -inset-20 rounded-full border border-dashed border-primary-foreground/15" />
            <img src={logo} alt="Grupo Confidence" className="auth-logo relative h-44 w-auto drop-shadow-2xl" />
          </div>
          <h2 className="mt-16 text-3xl font-semibold">Segurança, organização e controle.</h2>
          <p className="mt-3 max-w-sm opacity-75">Acesso individual, permissões por perfil e registro de todas as ações.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs">
            {[[ShieldCheck, "Acesso protegido"], [Fingerprint, "Login individual"], [Activity, "Auditoria ativa"]].map(([Icon, t]) => {
              const I = Icon as typeof ShieldCheck;
              return <span key={t as string} className="flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 backdrop-blur"><I className="h-3.5 w-3.5" />{t as string}</span>;
            })}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-xs opacity-60">
          <span>© Grupo Confidence</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />Conexão criptografada</span>
        </div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-lg">
          <div className="flex justify-center md:hidden"><img src={logo} alt="Grupo Confidence" className="h-20 w-auto" /></div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary"><Lock className="h-3.5 w-3.5" />Área restrita</div>
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
