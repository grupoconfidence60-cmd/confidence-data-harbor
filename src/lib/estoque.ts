export type Mov = { material_id: string; tipo: string; quantidade: number; colaborador_id: string | null };

export const MOV_LABELS: Record<string, string> = { entrada: "Entrada no estoque", entrega: "Entrega", devolucao: "Devolução", troca: "Troca", baixa: "Baixa (perda/dano)" };

/** Stock on hand: entries and returns add; deliveries and write-offs subtract; swaps are neutral. */
export function saldo(movs: Mov[], materialId: string) {
  return movs.filter((m) => m.material_id === materialId).reduce((s, m) => s + (m.tipo === "entrada" || m.tipo === "devolucao" ? m.quantidade : m.tipo === "entrega" || m.tipo === "baixa" ? -m.quantidade : 0), 0);
}

/** Units delivered and not yet returned, optionally for one employee. */
export function pendentes(movs: Mov[], materialId: string, colaboradorId?: string) {
  return movs.filter((m) => m.material_id === materialId && (!colaboradorId || m.colaborador_id === colaboradorId)).reduce((s, m) => s + (m.tipo === "entrega" ? m.quantidade : m.tipo === "devolucao" ? -m.quantidade : 0), 0);
}

export const CATEGORIA_LABELS: Record<string, string> = { uniforme: "Uniforme", equipamento: "Equipamento", escritorio: "Material de escritório", manutencao: "Manutenção eletrônica" };

/** Display order of stock groups, matching the company's stock workbook. */
export const GRUPOS_ESTOQUE = ["Vigia", "Vigilante", "Bombeiro civil", "Calçados e complementos", "Outros", "Administrativo", "Manutenção eletrônica"];

/** An item must be bought when a minimum is set and the stock on hand is below it. */
export function precisaComprar(emEstoque: number, minimo: number) {
  return minimo > 0 && emEstoque < minimo;
}
