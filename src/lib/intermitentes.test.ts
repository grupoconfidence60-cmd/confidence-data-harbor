import { describe, expect, it } from "vitest";
import { normalizarDisponibilidade, validarDisponibilidade } from "@/lib/intermitentes";

describe("disponibilidade dos intermitentes", () => {
  it("aceita Disponível sem exigir detalhe e limpa uma ocupação anterior", () => {
    expect(validarDisponibilidade("disponivel", "")).toBeNull();
    expect(normalizarDisponibilidade("disponivel", "West Shopping")).toEqual({
      disponibilidade_status: "disponivel",
      disponibilidade_detalhe: null,
    });
  });

  it("exige selecionar o posto de destino quando estiver Em ocupação", () => {
    expect(validarDisponibilidade("ocupado", "West Shopping")).toBe("Selecione o posto para alocar o intermitente.");
    expect(validarDisponibilidade("ocupado", "", "posto-west-id")).toBeNull();
  });

  it("exige o nome da pessoa quando estiver Cobrindo alguém", () => {
    expect(validarDisponibilidade("cobrindo", "")).toBe("Informe quem está sendo coberto.");
    expect(validarDisponibilidade("cobrindo", "João Silva")).toBeNull();
  });

  it("recusa uma situação fora das três previstas", () => {
    expect(validarDisponibilidade("livre", "")).toBe("Selecione uma situação válida.");
  });
});
