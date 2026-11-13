import { describe, expect, it } from "vitest";
import { destinoMaterial, postoEntrega, nomeDestinoMaterial } from "./material-reserva";

describe("entregas para reserva", () => {
  it("classifica colaborador sem posto como reserva", () => {
    expect(destinoMaterial(null, [])).toBe("reserva");
  });
  it("salva reserva sem criar vínculo com posto", () => {
    expect(postoEntrega("reserva")).toBeNull();
  });
  it("mantém o posto de quem já está alocado", () => {
    expect(destinoMaterial("posto-1", [{ id: "posto-1" }])).toBe("posto-1");
  });
  it("não reaproveita destino quando o posto não está disponível", () => {
    expect(destinoMaterial("posto-2", [{ id: "posto-1" }])).toBe("");
  });
  it("identifica entregas sem posto no histórico", () => {
    expect(nomeDestinoMaterial(null, [])).toBe("Reserva");
  });
});