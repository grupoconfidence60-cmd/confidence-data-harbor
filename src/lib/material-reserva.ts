export const RESERVA = "reserva";

export function destinoMaterial(postoId: string | null, postos: { id: string }[]) {
  return postoId ? (postos.some((p) => p.id === postoId) ? postoId : "") : RESERVA;
}

export function postoEntrega(destino: string): string | null {
  return destino === RESERVA ? null : destino;
}

export function nomeDestinoMaterial(postoId: string | null, postos: { id: string; nome: string }[]) {
  return postoId === null ? "Reserva" : postos.find((p) => p.id === postoId)?.nome ?? "Posto indisponível";
}