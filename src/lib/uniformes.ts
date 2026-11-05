import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function normalizarUniforme(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function ehUniforme(categoria: string) {
  return ["uniforme", "uniformes"].includes(normalizarUniforme(categoria));
}

export function separarTamanhos(value: string) {
  const tamanhos = new Map<string, string>();
  for (const parte of value.split(/[,;\n]+/)) {
    const tamanho = parte.trim().replace(/\s+/g, " ");
    const chave = normalizarUniforme(tamanho);
    if (chave && !tamanhos.has(chave)) tamanhos.set(chave, tamanho);
  }
  return [...tamanhos.values()];
}

type Resultado = { criados: number; existentes: number; reativados: number };

export async function cadastrarTamanhosUniforme(input: {
  nome: string;
  categoria: string;
  tamanhos: string[];
  identificacao?: string | undefined;
}): Promise<Resultado> {
  // Usa o cliente autenticado existente; a nova função ainda não consta
  // nos tipos gerados do Supabase.
  const client = supabase as unknown as SupabaseClient;
  const { data, error } = await client.rpc("cadastrar_tamanhos_uniforme", {
    p_nome: input.nome,
    p_categoria: input.categoria,
    p_tamanhos: input.tamanhos,
    p_identificacao: input.identificacao ?? "",
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data.criados !== "number" || typeof data.existentes !== "number" || typeof data.reativados !== "number") {
    throw new Error("Não foi possível confirmar o cadastro dos tamanhos. Atualize a lista para conferir.");
  }
  return data as Resultado;
}

export function resumoTamanhos(result: Resultado) {
  return `${result.criados} tamanho(s) cadastrado(s), ${result.existentes} já existente(s) e ${result.reativados} reativado(s).`;
}
