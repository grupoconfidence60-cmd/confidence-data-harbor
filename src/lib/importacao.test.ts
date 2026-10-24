import { describe, it, expect } from "vitest";
import { parseImport } from "./importacao";

const refs = { funcoes: [{ id: "f1", nome: "Vigilante" }], postos: [{ id: "p1", nome: "West Shopping" }], existentes: ["100"], escalas: [{ value: "par", label: "12x36 · Par" }] };
const head = ["Matrícula", "Nome", "Função", "Posto", "Admissão", "Escala"];

describe("importação de colaboradores", () => {
  it("resolve função, posto, escala e data brasileira", () => {
    const [r] = parseImport([head, ["200", "Ana", "vigilante", "WEST SHOPPING", "05/03/2024", "par"]], refs);
    expect(r).toMatchObject({ funcao_id: "f1", posto_id: "p1", data_admissao: "2024-03-05", jornada: "par", erros: [] });
  });
  it("rejeita matrícula já cadastrada ou repetida na planilha", () => {
    const rows = parseImport([head, ["100", "A"], ["300", "B"], ["300", "C"]], refs);
    expect(rows.map((r) => r.erros.length > 0)).toEqual([true, false, true]);
  });
  it("aponta posto inexistente e ignora linhas vazias", () => {
    const rows = parseImport([head, ["400", "D", "", "Outro"], ["", "", "", ""]], refs);
    expect(rows).toHaveLength(1);
    expect(rows[0].erros[0]).toContain("Posto");
  });
});
