import type { ReactNode } from "react";
import { useMe } from "@/lib/use-me";
import { canAccess } from "@/lib/labels";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (!me || !canAccess(me.roles, module))
    return <p className="mt-20 text-center text-muted-foreground">Você não tem permissão para acessar este módulo.</p>;
  return <>{children}</>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
