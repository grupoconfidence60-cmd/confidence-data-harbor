export type AppRole = "admin" | "gestor" | "supervisor" | "rh" | "colaborador";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador geral",
  gestor: "Gestor",
  supervisor: "Supervisor operacional",
  rh: "RH / Departamento pessoal",
  colaborador: "Colaborador",
};

export const SITUACAO_LABELS = {
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  desligado: "Desligado",
} as const;

export const STATUS_LABELS = { ativo: "Ativo", inativo: "Inativo", bloqueado: "Bloqueado" } as const;

export const PRESENCA_LABELS = {
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  atestado: "Atestado",
  folga: "Folga",
  ferias: "Férias",
} as const;

export const FERIAS_LABELS = {
  solicitada: "Solicitada",
  aprovada: "Aprovada",
  em_gozo: "Em gozo",
  concluida: "Concluída",
  recusada: "Recusada",
} as const;

export const GRAVIDADE_LABELS = { leve: "Leve", moderada: "Moderada", grave: "Grave" } as const;

export const DOCUMENTO_TIPOS = ["Atestado", "Contrato", "Identidade", "Certificado", "Advertência", "Outro"];

/** Which roles can open each module. */
export const MODULE_ACCESS: Record<string, AppRole[]> = {
  painel: ["admin", "gestor", "rh", "supervisor"],
  ponto: ["admin", "gestor", "rh", "supervisor", "colaborador"],
  colaboradores: ["admin", "gestor", "rh", "supervisor"],
  postos: ["admin", "gestor", "rh", "supervisor"],
  funcoes: ["admin", "gestor"],
  escalas: ["admin", "gestor", "rh", "supervisor"],
  presenca: ["admin", "gestor", "rh", "supervisor"],
  ferias: ["admin", "gestor", "rh", "supervisor"],
  ocorrencias: ["admin", "gestor", "rh", "supervisor", "colaborador"],
  relatorios: ["admin", "gestor", "rh"],
  documentos: ["admin", "gestor", "rh", "supervisor"],
  materiais: ["admin", "gestor", "rh", "supervisor"],
  inspecoes: ["admin", "gestor", "rh", "supervisor"],
  comunicados: ["admin", "gestor", "rh", "supervisor", "colaborador"],
  visitas: ["admin", "gestor", "rh", "supervisor"],
  usuarios: ["admin"],
  auditoria: ["admin"],
};

export function canAccess(roles: AppRole[], module: string) {
  return roles.some((r) => MODULE_ACCESS[module]?.includes(r));
}

export function canEditColaboradores(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}
export function canEditPostos(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor"].includes(r));
}
export function canEditEscalas(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor"].includes(r));
}
export function canEditPresenca(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh", "supervisor"].includes(r));
}
export function canEditFerias(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}
export function canEditOcorrencias(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}
export function canCreateOcorrencias(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh", "supervisor", "colaborador"].includes(r));
}
export function canEditDocumentos(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}
export function canCreateVisitas(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "supervisor"].includes(r));
}

export function canManageComunicados(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}

export function canManageMateriais(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "rh"].includes(r));
}

export function canManageChecklists(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor"].includes(r));
}
export function canCreateInspecoes(roles: AppRole[]) {
  return roles.some((r) => ["admin", "gestor", "supervisor"].includes(r));
}
