import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users, MapPin, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grupo Confidence — Sistema Integrado de Gestão Operacional" },
      { name: "description", content: "Acesso restrito ao sistema de gestão de colaboradores, postos, escalas e ocorrências do Grupo Confidence." },
      { property: "og:title", content: "Grupo Confidence — Gestão Operacional" },
      { property: "og:description", content: "Sistema integrado de gestão operacional e administrativa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: Users, t: "Colaboradores", d: "Cadastro completo e histórico" },
    { icon: MapPin, t: "Postos", d: "Efetivo e supervisão" },
    { icon: ClipboardCheck, t: "Auditoria", d: "Rastreabilidade total" },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand text-primary-foreground">
      <div className="auth-grid pointer-events-none absolute inset-0" />
      <div className="auth-scan pointer-events-none absolute inset-x-0 h-32" />
      <div className="tech-orb pointer-events-none absolute -right-40 top-1/4 h-[520px] w-[520px] rounded-full" />
      <div className="auth-ring-2 pointer-events-none absolute -right-24 top-[30%] h-[400px] w-[400px] rounded-full border border-dashed border-primary-foreground/15" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <BrandMark />
        <div className="flex flex-1 flex-col justify-center py-16">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-brand-accent/40 px-3 py-1 text-xs text-brand-accent">
            <span className="live-dot live-ao_vivo" aria-hidden /> <ShieldCheck className="h-3.5 w-3.5" /> Acesso restrito a usuários autorizados
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Sistema Integrado de <span className="tech-gradient-text">Gestão Operacional</span>
          </h1>
          <p className="mt-5 max-w-xl text-base opacity-80 md:text-lg">
            Colaboradores, postos de serviço, supervisão e controle em um único ambiente seguro.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90">
              <Link to="/auth">Acessar o sistema</Link>
            </Button>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {items.map((i) => (
              <div key={i.t} className="tech-card rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-5 backdrop-blur">
                <i.icon className="h-5 w-5 text-brand-accent" />
                <div className="mt-3 font-semibold">{i.t}</div>
                <div className="text-sm opacity-70">{i.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
