import { describe, it, expect } from "vitest";
import { canAccess, canEditColaboradores, canEditPostos } from "./labels";

describe("permissões por perfil", () => {
  it("só administrador acessa usuários e auditoria", () => {
    expect(canAccess(["admin"], "usuarios")).toBe(true);
    expect(canAccess(["gestor"], "usuarios")).toBe(false);
    expect(canAccess(["rh"], "auditoria")).toBe(false);
  });
  it("colaborador não acessa o cadastro de colaboradores", () => {
    expect(canAccess(["colaborador"], "colaboradores")).toBe(false);
  });
  it("supervisor consulta mas não edita colaboradores", () => {
    expect(canAccess(["supervisor"], "colaboradores")).toBe(true);
    expect(canEditColaboradores(["supervisor"])).toBe(false);
  });
  it("RH edita colaboradores mas não postos", () => {
    expect(canEditColaboradores(["rh"])).toBe(true);
    expect(canEditPostos(["rh"])).toBe(false);
  });
});
