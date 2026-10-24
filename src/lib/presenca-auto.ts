export const TOLERANCIA_MIN = 15;
export type AutoStatus = "registrado" | "presente" | "atraso" | "aguardando" | "falta" | "folga" | "sem_escala";

/**
 * Status automático do dia: cruza a escala da planilha do posto com o ponto.
 * scheduled: "T" trabalha, "F" folga, null sem planilha no mês.
 */
export function statusAutomatico(opts: { scheduled: "T" | "F" | null; data: string; inicio?: string | undefined; entrada?: string | null | undefined; manual?: string | null | undefined; agora: Date }): AutoStatus {
  const { scheduled, data, inicio, entrada, manual, agora } = opts;
  if (manual && manual !== "presente") return "registrado";
  if (entrada || manual === "presente") {
    if (!entrada || !inicio) return "presente";
    const limite = new Date(`${data}T${inicio.slice(0, 5)}:00`).getTime() + TOLERANCIA_MIN * 60_000;
    return new Date(entrada).getTime() > limite ? "atraso" : "presente";
  }
  if (scheduled === null) return "sem_escala";
  if (scheduled === "F") return "folga";
  const limite = new Date(`${data}T${(inicio ?? "00:00").slice(0, 5)}:00`).getTime() + TOLERANCIA_MIN * 60_000;
  return agora.getTime() > limite ? "falta" : "aguardando";
}

export const AUTO_LABELS: Record<AutoStatus, string> = {
  registrado: "Registrado", presente: "Presente", atraso: "Atraso", aguardando: "Aguardando entrada", falta: "Falta (sem ponto)", folga: "Folga pela escala", sem_escala: "Sem escala no mês",
};
