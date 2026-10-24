import logoAsset from "@/assets/logo-confidence.png.asset.json";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={logoAsset.url}
        alt="Grupo Confidence"
        className="h-10 w-10 shrink-0 rounded-md bg-card object-contain p-0.5"
      />
      {!compact && (
        <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
          <div className="font-display text-[13px] font-semibold">GRUPO CONFIDENCE</div>
          <div className="mt-1 text-[10px] opacity-60">Gestão Operacional</div>
        </div>
      )}
    </div>
  );
}
