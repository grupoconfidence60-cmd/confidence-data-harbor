import logoAsset from "@/assets/logo-confidence.png.asset.json";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="Grupo Confidence"
        className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-0.5"
      />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-wide">GRUPO CONFIDENCE</div>
          <div className="text-[11px] opacity-70">Gestão Operacional</div>
        </div>
      )}
    </div>
  );
}
