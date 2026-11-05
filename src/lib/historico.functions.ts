import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RegistroPlanilha = {
  tipo: "entrada" | "saida";
  data?: string;
  nome?: string;
  cargo?: string;
  posto?: string;
  itens: string;
  quantidade?: number;
  valor?: number;
  fornecedor?: string;
  data_devolucao?: string;
  observacoes?: string;
  colaborador_id?: string;
};

// Histórico das abas Entrada e Saída da planilha "Estoque Confidence" (somente consulta; não altera saldos).
export const getHistoricoPlanilha = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_any_role", {
      _user_id: context.userId,
      _roles: ["admin", "gestor", "rh", "supervisor"],
    } as never);
    if (!data) throw new Error("Acesso negado.");
    const rows = (await import("@/server/historico-planilha.json")).default as RegistroPlanilha[];
    return rows;
  });
