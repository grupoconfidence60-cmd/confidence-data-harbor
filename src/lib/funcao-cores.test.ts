import { describe, it, expect } from "vitest";
import { funcaoTom } from "./funcao-cores";

describe("cores por função", () => {
  it("segue as cores pedidas", () => {
    expect(funcaoTom("Vigia")).toBe("vigia");
    expect(funcaoTom("Vigia Intermitente")).toBe("intermitente");
    expect(funcaoTom("Vigilante")).toBe("vigilante");
    expect(funcaoTom("Bombeiro Civil")).toBe("bombeiro");
    expect(funcaoTom("Bombeiro intermitente")).toBe("intermitente");
    expect(funcaoTom("Apoio")).toBe("outra");
  });
});
