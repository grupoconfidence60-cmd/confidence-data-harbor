/** Regras de dias das ausências registradas na aba Férias. */
export type FeriasTipo = "ferias" | "abono";

/** Dias calculados automaticamente para cada tipo: férias completas 30, abono pecuniário 20. */
export const DIAS_POR_TIPO: Record<FeriasTipo, number> = { ferias: 30, abono: 20 };

export const FERIAS_TIPO_LABELS: Record<FeriasTipo, string> = {
  ferias: "Férias completas",
  abono: "Abono pecuniário",
};

const DIA_MS = 86400000;

/** Data no formato yyyy-mm-dd e que existe de verdade no calendário. */
export function isDataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const ms = Date.parse(valor + "T00:00:00Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === valor;
}

/** Data final automática: início + a quantidade de dias do tipo, contando o próprio início. */
export function fimAutomatico(inicio: string, tipo: FeriasTipo) {
  if (!isDataValida(inicio)) return "";
  const ms = Date.parse(inicio + "T00:00:00Z") + (DIAS_POR_TIPO[tipo] - 1) * DIA_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Total de dias entre início e fim, incluindo as duas datas; null se inválido ou fim antes do início. */
export function diasTotais(inicio: string, fim: string) {
  if (!isDataValida(inicio) || !isDataValida(fim)) return null;
  const a = Date.parse(inicio + "T00:00:00Z");
  const b = Date.parse(fim + "T00:00:00Z");
  if (b < a) return null;
  return Math.round((b - a) / DIA_MS) + 1;
}
