import { describe, expect, it } from "vitest";
import { DIAS_POR_TIPO, diasTotais, fimAutomatico } from "./ferias";

describe("dias das férias e do abono", () => {
  it("férias completas têm 30 dias e abono pecuniário 20", () => {
    expect(DIAS_POR_TIPO.ferias).toBe(30);
    expect(DIAS_POR_TIPO.abono).toBe(20);
  });

  it("calcula o fim das férias em 30 dias a partir do início", () => {
    expect(fimAutomatico("2026-11-02", "ferias")).toBe("2026-12-01");
  });

  it("calcula o fim do abono em 20 dias a partir do início", () => {
    expect(fimAutomatico("2026-11-02", "abono")).toBe("2026-11-21");
  });

  it("não inventa fim quando a data de início é inválida", () => {
    expect(fimAutomatico("", "ferias")).toBe("");
    expect(fimAutomatico("2026-13-40", "abono")).toBe("");
  });

  it("conta os dias incluindo início e fim", () => {
    expect(diasTotais("2026-11-02", "2026-12-01")).toBe(30);
    expect(diasTotais("2026-11-02", "2026-11-21")).toBe(20);
    expect(diasTotais("2026-11-05", "2026-11-05")).toBe(1);
  });

  it("recusa fim anterior ao início", () => {
    expect(diasTotais("2026-11-05", "2026-11-02")).toBeNull();
  });
});
