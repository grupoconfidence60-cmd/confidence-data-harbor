import { describe, expect, it } from "vitest";
import { statusAutomatico } from "./presenca-auto";

describe("presença prevista pela escala", () => {
  it("todo colaborador escalado começa como presente, sem depender do horário", () => {
    expect(statusAutomatico({ scheduled: "T" })).toBe("presente");
  });

  it("não gera falta automática para quem está escalado", () => {
    expect(statusAutomatico({ scheduled: "T" })).not.toBe("falta");
  });

  it("a alteração manual dos supervisores e gestores prevalece", () => {
    expect(statusAutomatico({ scheduled: "T", manual: "falta" })).toBe("registrado");
    expect(statusAutomatico({ scheduled: "T", manual: "falta_justificada" })).toBe("registrado");
  });

  it("mantém folga e ausência de escala identificadas", () => {
    expect(statusAutomatico({ scheduled: "F" })).toBe("folga");
    expect(statusAutomatico({ scheduled: null })).toBe("sem_escala");
  });

  it("não deixa um registro antigo de presente substituir a folga pela escala", () => {
    expect(statusAutomatico({ scheduled: "F", manual: "presente" })).toBe("folga");
    expect(statusAutomatico({ scheduled: "F", manual: "folga" })).toBe("folga");
  });

  it("continua exibindo uma exceção manual diferente de presença no dia de folga", () => {
    expect(statusAutomatico({ scheduled: "F", manual: "atestado" })).toBe("registrado");
  });
});
