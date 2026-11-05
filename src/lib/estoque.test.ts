import { describe, it, expect } from "vitest";
import { saldo, pendentes } from "./estoque";

const movs = [
  { material_id: "a", tipo: "entrada", quantidade: 10, colaborador_id: null },
  { material_id: "a", tipo: "entrega", quantidade: 3, colaborador_id: "c1" },
  { material_id: "a", tipo: "devolucao", quantidade: 1, colaborador_id: "c1" },
  { material_id: "a", tipo: "troca", quantidade: 1, colaborador_id: "c1" },
  { material_id: "a", tipo: "baixa", quantidade: 2, colaborador_id: null },
];
describe("estoque", () => {
  it("saldo soma entradas e devoluções e subtrai entregas e baixas", () => expect(saldo(movs, "a")).toBe(6));
  it("pendentes de devolução por colaborador", () => expect(pendentes(movs, "a", "c1")).toBe(2));
});

import { precisaComprar } from "./estoque";
describe("precisaComprar", () => {
  it("flags stock below the minimum", () => expect(precisaComprar(1, 2)).toBe(true));
  it("does not flag stock equal to the minimum", () => expect(precisaComprar(2, 2)).toBe(false));
  it("does not flag items without a minimum", () => expect(precisaComprar(0, 0)).toBe(false));
});
