import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMe } from "@/lib/use-me";
import { canAccess } from "@/lib/labels";
import { Inbox } from "lucide-react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-heading mb-7 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (me && module === "painel" && !canAccess(me.roles, "painel") && canAccess(me.roles, "ponto")) return <Navigate to="/ponto" replace />;
  if (!me || !canAccess(me.roles, module))
    return <p className="mt-20 text-center text-muted-foreground">Você não tem permissão para acessar este módulo.</p>;
  return <>{children}</>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted-foreground"><Inbox className="h-7 w-7 opacity-50" strokeWidth={1.4} />{text}</div>;
}
