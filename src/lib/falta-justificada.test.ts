import { describe, expect, it } from "vitest";
import { TAMANHO_MAXIMO_ANEXO, validarAnexoJustificativa, validarFaltaJustificada } from "./falta-justificada";

const arquivo = { name: "justificativa.pdf", size: 1024 };

describe("falta justificada", () => {
  it("exige o anexo do documento", () => {
    expect(validarFaltaJustificada({ justificativa: "Atestado médico", arquivo: null })).toBe("Anexe o documento da falta justificada.");
  });

  it("exige o motivo da falta", () => {
    expect(validarFaltaJustificada({ justificativa: "   ", arquivo })).toBe("Descreva o motivo da falta justificada.");
  });

  it("aceita justificativa com documento de até 20 MB", () => {
    expect(validarFaltaJustificada({ justificativa: "Atestado médico", arquivo })).toBeNull();
    expect(validarFaltaJustificada({ justificativa: "Atestado médico", arquivo: { ...arquivo, size: TAMANHO_MAXIMO_ANEXO } })).toBeNull();
  });

  it("recusa documento acima de 20 MB", () => {
    expect(validarFaltaJustificada({ justificativa: "Atestado médico", arquivo: { ...arquivo, size: TAMANHO_MAXIMO_ANEXO + 1 } })).toBe("O documento deve ter no máximo 20 MB.");
  });
});
