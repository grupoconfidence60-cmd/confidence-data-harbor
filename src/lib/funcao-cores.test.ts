import { describe, it, expect } from "vitest";
import { FUNCAO_BORDA, FUNCAO_CLASSES, funcaoTom } from "./funcao-cores";

 describe("cores por função", () => {
  it("segue as cores pedidas", () => {
    expect(funcaoTom("Vigia")).toBe("vigia");
    expect(funcaoTom("Vigia Intermitente")).toBe("intermitente");
    expect(funcaoTom("Vigilante")).toBe("vigilante");
    expect(funcaoTom("Bombeiro Civil")).toBe("bombeiro");
    expect(funcaoTom("Bombeiro intermitente")).toBe("intermitente");
    expect(funcaoTom("Apoio")).toBe("outra");
  });

  it("usa preto com texto branco para assistente administrativo", () => {
    expect(funcaoTom("Assistente Administrativo")).toBe("administrativo");
    expect(funcaoTom("ASSISTENTE ADMINISTRATIVO")).toBe("administrativo");
    expect(funcaoTom(" Assistente  Administrativo ")).toBe("administrativo");
    expect(FUNCAO_CLASSES.administrativo).toBe("bg-black text-white");
    expect(FUNCAO_BORDA.administrativo).toBe("border-l-4 border-l-black");
  });

  it("usa cinza escuro para supervisor", () => {
    expect(funcaoTom("Supervisor")).toBe("supervisor");
    expect(funcaoTom("SUPERVISOR OPERACIONAL")).toBe("supervisor");
    expect(FUNCAO_CLASSES.supervisor).toContain("bg-neutral-700");
    expect(FUNCAO_BORDA.supervisor).toContain("border-l-neutral-700");
  });
});
