import * as XLSX from "xlsx";
import type { AppRole } from "./labels";

export type PlanilhaRow = { id: string; colaborador_id: string; paridade: string; turno: string; hora_inicio: string; hora_fim: string; ajustes: unknown; observacoes: string };
export type PlanilhaPerson = { id: string; nome: string; matricula: string; funcoes: { nome: string } | null };

export function canManagePlanilha(roles: AppRole[], userId: string | undefined, supervisorId: string | null) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r)) || (roles.includes("supervisor") && Boolean(userId) && userId === supervisorId);
}
export function monthDays(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}
export function dayStatus(row: Pick<PlanilhaRow, "paridade" | "ajustes">, day: number): "T" | "F" {
  const adjustments = row.ajustes && typeof row.ajustes === "object" && !Array.isArray(row.ajustes) ? row.ajustes as Record<string, unknown> : {};
  const value = adjustments[String(day)];
  if (value === "T" || value === "F") return value;
  return (day % 2 === 0) === (row.paridade === "par") ? "T" : "F";
}
export function scheduleWorkbook(post: string, month: string, rows: PlanilhaRow[], people: PlanilhaPerson[]) {
  const days = Array.from({ length: monthDays(month) }, (_, i) => i + 1);
  const headers = ["Matrícula", "Colaborador", "Função", "Escala", "Turno", "Entrada", "Saída", ...days.map(String), "Plantões previstos", "Observações"];
  const grid: (string | number)[][] = [["Grupo Confidence — Escala mensal"], ["Posto", post, "Mês", month], ["T = Trabalho previsto", "F = Folga prevista"], headers];
  for (const row of rows) {
    const person = people.find((p) => p.id === row.colaborador_id);
    grid.push([person?.matricula ?? "", person?.nome ?? "Colaborador indisponível", person?.funcoes?.nome ?? "", row.paridade === "par" ? "Par" : "Ímpar", row.turno === "noturno" ? "Noturno" : "Diurno", row.hora_inicio.slice(0, 5), row.hora_fim.slice(0, 5), ...days.map((d) => dayStatus(row, d)), "", row.observacoes]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  rows.forEach((_, i) => {
    const r = i + 5;
    sheet[XLSX.utils.encode_cell({ r: r - 1, c: 7 + days.length })] = { t: "n", f: `COUNTIF(H${r}:${XLSX.utils.encode_col(6 + days.length)}${r},"T")` };
  });
  sheet["!cols"] = headers.map((_, i) => ({ wch: i === 1 ? 36 : i === 2 || i === headers.length - 1 ? 28 : i >= 7 && i < 7 + days.length ? 4 : 18 }));
  sheet["!autofilter"] = { ref: `A4:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(4, grid.length)}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Escala mensal");
  return workbook;
}
export function downloadSchedule(post: string, month: string, rows: PlanilhaRow[], people: PlanilhaPerson[]) {
  const bytes = XLSX.write(scheduleWorkbook(post, month, rows, people), { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Escala-${post.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "-")}-${month}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}