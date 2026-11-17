import type { AppRole } from "@/lib/labels";

export const DISPONIBILIDADE_INTERMITENTE = {
  disponivel: "Disponível",
  ocupado: "Em ocupação",
  cobrindo: "Cobrindo alguém",
} as const;

export type DisponibilidadeIntermitente = keyof typeof DISPONIBILIDADE_INTERMITENTE;

export function isPostoIntermitentes(posto: { nome: string; tipo?: string | null }) {
  return posto.tipo?.trim().toLocaleLowerCase("pt-BR") === "intermitentes"
    || posto.nome.trim().toLocaleLowerCase("pt-BR") === "intermitentes";
}

export function canEditIntermitentes(roles: AppRole[]) {
  return roles.some((role) => ["admin", "gestor", "rh", "supervisor"].includes(role));
}

export function disponibilidadeValida(value: string): value is DisponibilidadeIntermitente {
  return value in DISPONIBILIDADE_INTERMITENTE;
}

export function validarDisponibilidade(status: string, detalhe: string): string | null {
  if (!disponibilidadeValida(status)) return "Selecione uma situação válida.";
  if (status === "ocupado" && !detalhe.trim()) return "Informe o posto ou a ocupação atual.";
  if (status === "cobrindo" && !detalhe.trim()) return "Informe quem está sendo coberto.";
  return null;
}

export function normalizarDisponibilidade(status: DisponibilidadeIntermitente, detalhe: string) {
  return {
    disponibilidade_status: status,
    disponibilidade_detalhe: status === "disponivel" ? null : detalhe.trim() || null,
  };
}
