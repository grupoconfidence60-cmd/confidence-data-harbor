import logo from "@/assets/logo-confidence-transparente.png";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src={logo} alt="Grupo Confidence" className="h-10 w-10 shrink-0 object-contain drop-shadow-md" />
      {!compact && (
        <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
          <div className="font-display text-[13px] font-semibold">GRUPO CONFIDENCE</div>
          <div className="mt-1 text-[10px] opacity-60">Gestão Operacional</div>
        </div>
      )}
    </div>
  );
}
