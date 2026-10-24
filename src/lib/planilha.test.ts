import { describe, expect, it } from "vitest";
import { canManagePlanilha, dayStatus, monthDays, scheduleWorkbook } from "./planilha";

describe("planilha mensal por posto", () => {
  it("pares trabalham nos dias 2, 4, 6 e ímpares nos dias 1, 3, 5", () => {
    expect([1, 2, 3, 4, 5, 6].map((d) => dayStatus({ paridade: "par", ajustes: {} }, d))).toEqual(["F", "T", "F", "T", "F", "T"]);
    expect([1, 2, 3, 4, 5, 6].map((d) => dayStatus({ paridade: "impar", ajustes: {} }, d))).toEqual(["T", "F", "T", "F", "T", "F"]);
  });
  it("respeita fevereiro bissexto e meses com 30/31 dias", () => {
    expect(monthDays("2028-02")).toBe(29);
    expect(monthDays("2026-02")).toBe(28);
    expect(monthDays("2026-04")).toBe(30);
    expect(monthDays("2026-10")).toBe(31);
  });
  it("ajustes diários prevalecem sobre a paridade", () => {
    expect(dayStatus({ paridade: "par", ajustes: { "1": "T", "2": "F" } }, 1)).toBe("T");
    expect(dayStatus({ paridade: "par", ajustes: { "1": "T", "2": "F" } }, 2)).toBe("F");
  });
  it("admin gestor RH gerenciam todos; supervisor somente seu posto", () => {
    for (const role of ["admin", "gestor", "rh"] as const) expect(canManagePlanilha([role], "u", "outro")).toBe(true);
    expect(canManagePlanilha(["supervisor"], "u", "u")).toBe(true);
    expect(canManagePlanilha(["supervisor"], "u", "outro")).toBe(false);
    expect(canManagePlanilha(["colaborador"], "u", "u")).toBe(false);
  });
  it("Excel identifica posto, matrícula, colaborador, mês e todos os dias", () => {
    const sheet = scheduleWorkbook("Via Brasil", "2026-02", [{ id: "1", colaborador_id: "c", paridade: "par", turno: "diurno", hora_inicio: "06:00", hora_fim: "18:00", ajustes: {}, observacoes: "" }], [{ id: "c", nome: "Pessoa Teste", matricula: "123", funcoes: { nome: "Vigilante" } }]).Sheets["Escala mensal"];
    if (!sheet) throw new Error("Planilha não gerada");
    expect(sheet["B2"].v).toBe("Via Brasil");
    expect(sheet["D2"].v).toBe("2026-02");
    expect(sheet["A5"].v).toBe("123");
    expect(sheet["B5"].v).toBe("Pessoa Teste");
    expect(sheet["H5"].v).toBe("F");
    expect(sheet["I5"].v).toBe("T");
    expect(sheet["AI4"].v).toBe("28");
    expect(sheet["AJ5"].f).toBe('COUNTIF(H5:AI5,"T")');
  });
});