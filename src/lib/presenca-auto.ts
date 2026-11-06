export type AutoStatus = "registrado" | "presente" | "folga" | "sem_escala";

/**
 * A escala define a presença prevista. Não há mais falta automática por horário:
 * supervisores e gestores registram somente as exceções observadas no dia.
 */
export function statusAutomatico(opts: {
  scheduled: "T" | "F" | null;
  manual?: string | null | undefined;
}): AutoStatus {
  if (opts.manual) return "registrado";
  if (opts.scheduled === "T") return "presente";
  if (opts.scheduled === "F") return "folga";
  return "sem_escala";
}

export const AUTO_LABELS: Record<AutoStatus, string> = {
  registrado: "Alteração manual",
  presente: "Presente pela escala",
  folga: "Folga pela escala",
  sem_escala: "Sem escala no mês",
};
