import { describe, it, expect } from "vitest";
import { canAccess, canEditColaboradores, canEditPostos, canEditOcorrencias, canManageComunicados, canManageMateriais, canManageChecklists, canCreateInspecoes, canCreateOcorrencias, MODULE_ACCESS, type AppRole } from "./labels";

describe("permissões por perfil", () => {
  it("checklists: admin/gestor criam modelos; supervisor inspeciona; RH só consulta; colaborador sem acesso", () => {
    expect(canManageChecklists(["gestor"])).toBe(true);
    expect(canManageChecklists(["supervisor"])).toBe(false);
    expect(canCreateInspecoes(["supervisor"])).toBe(true);
    expect(canCreateInspecoes(["rh"])).toBe(false);
    expect(canAccess(["rh"], "inspecoes")).toBe(true);
    expect(canAccess(["colaborador"], "inspecoes")).toBe(false);
  });
  it("gestão e supervisão acessam materiais; catálogo é gerido por admin, gestor e RH", () => {
    for (const role of ["admin", "gestor", "rh"] as AppRole[]) {
      expect(canAccess([role], "materiais")).toBe(true);
      expect(canManageMateriais([role])).toBe(true);
    }
    expect(canAccess(["supervisor"], "materiais")).toBe(true);
    expect(canManageMateriais(["supervisor"])).toBe(false);
    expect(canAccess(["colaborador"], "materiais")).toBe(false);
    expect(canManageMateriais([])).toBe(false);
  });
  it("colaborador acessa apenas ponto, solicitações e comunicados", () => {
    const mods = Object.keys(MODULE_ACCESS).filter((m) => canAccess(["colaborador"], m)).sort();
    expect(mods).toEqual(["comunicados", "ocorrencias", "ponto"]);
    expect(canCreateOcorrencias(["colaborador"])).toBe(true);
    expect(canManageComunicados(["colaborador"])).toBe(false);
  });
  it("todos consultam comunicados; administração, gestores e RH publicam", () => {
    const roles: AppRole[] = ["admin", "gestor", "rh", "supervisor", "colaborador"];
    for (const role of roles) {
      expect(canAccess([role], "comunicados")).toBe(true);
      expect(canManageComunicados([role])).toBe(["admin", "gestor", "rh"].includes(role));
    }
    expect(canManageComunicados([])).toBe(false);
  });
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
  it("administração, gestores e RH dão baixa nas solicitações; supervisor e colaborador não", () => {
    for (const role of ["admin", "gestor", "rh"] as AppRole[]) {
      expect(canEditOcorrencias([role])).toBe(true);
    }
    expect(canEditOcorrencias(["supervisor"])).toBe(false);
    expect(canEditOcorrencias(["colaborador"])).toBe(false);
    expect(canEditOcorrencias([])).toBe(false);
  });
  it("RH edita colaboradores mas não postos", () => {
    expect(canEditColaboradores(["rh"])).toBe(true);
    expect(canEditPostos(["rh"])).toBe(false);
  });
});
