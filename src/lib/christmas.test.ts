import { describe, expect, it } from "vitest";
import { isChristmasDecorationsActive } from "./christmas";

describe("Decoração de Natal", () => {
  it("está disponível a partir de 23 de novembro de 2026", () => {
    expect(isChristmasDecorationsActive(new Date(2026, 10, 22, 23, 59))).toBe(false);
    expect(isChristmasDecorationsActive(new Date(2026, 10, 23, 0, 0))).toBe(true);
  });

  it("permanece visível até 25 de dezembro às 23:59", () => {
    expect(isChristmasDecorationsActive(new Date(2026, 11, 25, 23, 59, 59, 999))).toBe(true);
  });

  it("é retirada automaticamente a partir de 26 de dezembro", () => {
    expect(isChristmasDecorationsActive(new Date(2026, 11, 26, 0, 0))).toBe(false);
    expect(isChristmasDecorationsActive(new Date(2027, 10, 23, 0, 0))).toBe(false);
  });
});
