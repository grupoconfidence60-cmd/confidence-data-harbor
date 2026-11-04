import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABELAS = [
  "colaboradores", "postos", "presencas", "posto_planilha", "ocorrencias", "ferias", "comunicados",
  "comunicado_leituras", "materiais", "material_entregas", "material_movimentacoes", "visitas",
  "inspecoes", "documentos", "funcoes", "notificacoes",
];

/** Mantém todas as telas atualizadas: qualquer mudança no banco recarrega os dados visíveis. */
export function useLiveSync() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"conectando" | "ao_vivo" | "offline">("conectando");
  const [ultima, setUltima] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ch = supabase.channel(`live-sync-${Math.random().toString(36).slice(2)}`);
    for (const table of TABELAS) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          qc.invalidateQueries();
          setUltima(new Date());
        }, 800);
      });
    }
    ch.subscribe((s) => setStatus(s === "SUBSCRIBED" ? "ao_vivo" : s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED" ? "offline" : "conectando"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return { status, ultima };
}

export function LiveIndicator() {
  const { status, ultima } = useLiveSync();
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const i = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const label = status === "ao_vivo" ? "Ao vivo" : status === "offline" ? "Reconectando" : "Conectando";
  return (
    <div className="live-indicator hidden items-center gap-3 rounded-md border px-3 py-1.5 text-[11px] md:flex" title={ultima ? `Última atualização: ${ultima.toLocaleTimeString("pt-BR")}` : "Aguardando mudanças"}>
      <span className={`live-dot live-${status}`} aria-hidden />
      <span className="font-semibold uppercase tracking-wider">{label}</span>
      <span className="h-3 border-l" />
      <span className="font-mono tabular-nums text-muted-foreground">{agora?.toLocaleTimeString("pt-BR") ?? "--:--:--"}</span>
    </div>
  );
}
