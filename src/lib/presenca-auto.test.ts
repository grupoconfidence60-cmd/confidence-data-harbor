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

  it("mostra férias automaticamente mesmo quando a escala previa trabalho", () => {
    expect(statusAutomatico({ scheduled: "T", onVacation: true })).toBe("ferias");
  });

  it("férias prevalecem sobre registros automáticos antigos de presença ou folga", () => {
    expect(statusAutomatico({ scheduled: "F", manual: "presente", onVacation: true })).toBe("ferias");
    expect(statusAutomatico({ scheduled: "T", manual: "folga", onVacation: true })).toBe("ferias");
  });

  it("preserva falta, falta justificada e atestado registrados manualmente durante as férias", () => {
    expect(statusAutomatico({ scheduled: "T", manual: "falta", onVacation: true })).toBe("registrado");
    expect(statusAutomatico({ scheduled: "T", manual: "falta_justificada", onVacation: true })).toBe("registrado");
    expect(statusAutomatico({ scheduled: "T", manual: "atestado", onVacation: true })).toBe("registrado");
  });
});
