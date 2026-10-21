import { ShieldCheck } from "lucide-react";

/** Temporary brand mark until the official logo is provided. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gold text-gold-foreground">
        <ShieldCheck className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-wide">GRUPO CONFIDENCE</div>
          <div className="text-[11px] opacity-70">Gestão Operacional</div>
        </div>
      )}
    </div>
  );
}
