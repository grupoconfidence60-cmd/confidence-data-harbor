import { describe, expect, it } from "vitest";
import { canManagePlanilha, dayStatus, dayStatusComFerias, monthDays, rosterGroup, rosterMove, rosterWorkbook, scheduleWorkbook } from "./planilha";

describe("planilha mensal por posto", () => {
  const row = { id: "1", colaborador_id: "c", paridade: "impar", escala_tipo: "impar", turno: "diurno", hora_inicio: "07:00", hora_fim: "19:00", ajustes: { "1": "F" }, observacoes: "", posicao: "Portaria" };
  it("mover o colaborador inteiro atualiza escala e turno sem alterar ajustes ou cadastro", () => {
    const moved = { ...row, ...rosterMove("par", "noturno") };
    expect(moved.escala_tipo).toBe("par");
    expect(moved.paridade).toBe("par");
    expect(moved.turno).toBe("noturno");
    expect(moved.colaborador_id).toBe("c");
    expect(moved.ajustes).toEqual({ "1": "F" });
    expect(moved.posicao).toBe("Portaria");
  });
  it("outras escalas não são forçadas a par ou ímpar", () => {
    expect(rosterGroup({ ...row, escala_tipo: "5x2" })).toBe("outras");
    expect(rosterGroup(row)).toBe("impar");
    expect(rosterGroup({ ...row, escala_tipo: "par" })).toBe("par");
  });
  it("exporta listas lado a lado com posição e horário e mantém grade mensal", () => {
    const book = rosterWorkbook("West Shopping", "2026-10", [row, { ...row, id: "2", colaborador_id: "d", escala_tipo: "par", posicao: "Docas" }], [{ id: "c", nome: "Pessoa Ímpar", matricula: "807", funcoes: null }, { id: "d", nome: "Pessoa Par", matricula: "759", funcoes: null }]);
    const sheet = book.Sheets["Colaboradores por escala"];
    if (!sheet) throw new Error("Listas não geradas");
    expect(sheet["A7"].v).toBe("807");
    expect(sheet["C7"].v).toBe("Portaria");
    expect(sheet["D7"].v).toBe("07:00 às 19:00");
    expect(sheet["F7"].v).toBe("759");
    expect(sheet["H7"].v).toBe("Docas");
    expect(book.SheetNames).toContain("Escala mensal");
  });
  it("escala personalizada não impõe alternância e aceita plantões escolhidos", () => {
    expect(dayStatus({ paridade: "impar", escala_tipo: "livre", ajustes: {} }, 1, "2026-10")).toBe("F");
    expect(dayStatus({ paridade: "impar", escala_tipo: "livre", ajustes: { "2": "T" } }, 2, "2026-10")).toBe("T");
  });
  it("oferece escalas semanais além de par e ímpar", () => {
    expect(dayStatus({ paridade: "impar", escala_tipo: "5x2", ajustes: {} }, 23, "2026-10")).toBe("T");
    expect(dayStatus({ paridade: "impar", escala_tipo: "5x2", ajustes: {} }, 24, "2026-10")).toBe("F");
    expect(dayStatus({ paridade: "impar", escala_tipo: "6x1", ajustes: {} }, 24, "2026-10")).toBe("T");
    expect(dayStatus({ paridade: "impar", escala_tipo: "6x1", ajustes: {} }, 25, "2026-10")).toBe("F");
  });
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
    expect(canManagePlanilha(["supervisor"], "u", "outro", ["u"])).toBe(true);
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
    expect(sheet["AJ5"].v).toBe(14);
  });
  it("marca FÉ nos dias de férias, desconta os plantões previstos e exporta a cobertura", () => {
    const period = { id: "f1", colaborador_id: "c", data_inicio: "2026-11-12", data_fim: "2026-12-11", status: "em_gozo", cobertura: "Mariana" };
    const vacationRow = { ...row, paridade: "par", escala_tipo: "par", ajustes: {} };
    const person = { id: "c", nome: "Pessoa Ímpar", matricula: "807", funcoes: null };
    expect(dayStatus(vacationRow, 12, "2026-11")).toBe("T");
    expect(dayStatusComFerias(vacationRow, 12, "2026-11", period)).toBe("FÉ");
    expect(dayStatusComFerias(vacationRow, 13, "2026-11", period)).toBe("FÉ");
    expect(dayStatusComFerias(vacationRow, 10, "2026-11", period)).toBe("T");
    const book = rosterWorkbook("West", "2026-11", [vacationRow], [person], [period]);
    expect(book.Sheets["Escala mensal"]?.["S5"].v).toBe("FÉ");
    expect(book.Sheets["Escala mensal"]?.["AL5"].v).toBe(5);
    expect(book.Sheets["Colaboradores por escala"]?.["G7"].v).toContain("Cobertura: Mariana");
    expect(book.Sheets["Férias e coberturas"]?.["F5"].v).toBe("Mariana");
    expect(book.Sheets["Férias e coberturas"]?.["G5"].v).toBe("Sim");
  });
  it("identifica no Excel quem tem férias mas está fora da planilha", () => {
    const period = { id: "f2", colaborador_id: "c", data_inicio: "2026-11-12", data_fim: "2026-12-11", status: "em_gozo", cobertura: null };
    const book = rosterWorkbook("West", "2026-11", [], [{ id: "c", nome: "Pessoa", matricula: "807", funcoes: null }], [period]);
    expect(book.Sheets["Férias e coberturas"]?.["G5"].v).toBe("Fora da planilha");
    expect(book.Sheets["Férias e coberturas"]?.["F5"].v).toBe("Não informada");
  });
});