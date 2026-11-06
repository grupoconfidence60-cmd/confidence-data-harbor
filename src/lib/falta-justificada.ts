import { supabase } from "@/integrations/supabase/client";

export const TAMANHO_MAXIMO_ANEXO = 20 * 1024 * 1024;

export function validarFaltaJustificada(input: {
  justificativa: string;
  arquivo: { name: string; size: number } | null;
}) {
  if (!input.justificativa.trim()) return "Descreva o motivo da falta justificada.";
  if (input.justificativa.trim().length > 2000) return "A justificativa deve ter no máximo 2.000 caracteres.";
  if (!input.arquivo) return "Anexe o documento da falta justificada.";
  if (input.arquivo.size <= 0) return "O arquivo selecionado está vazio.";
  if (input.arquivo.size > TAMANHO_MAXIMO_ANEXO) return "O documento deve ter no máximo 20 MB.";
  return null;
}

/** Envia o arquivo privado e liga o documento à falta; remove o arquivo se o vínculo falhar. */
export async function anexarJustificativa(input: {
  presencaId: string;
  colaboradorId: string;
  data: string;
  justificativa: string;
  arquivo: File;
}) {
  const invalido = validarFaltaJustificada(input);
  if (invalido) return { error: invalido };
  const nomeSeguro = input.arquivo.name.normalize("NFD").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${input.colaboradorId}/${crypto.randomUUID()}-${nomeSeguro}`;
  const { error: uploadError } = await supabase.storage.from("documentos").upload(path, input.arquivo);
  if (uploadError) return { error: "Não foi possível enviar o arquivo. Tente novamente." };

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("documentos").insert({
    colaborador_id: input.colaboradorId,
    presenca_id: input.presencaId,
    tipo: "Justificativa de falta",
    titulo: `Justificativa de falta — ${new Date(`${input.data}T12:00:00`).toLocaleDateString("pt-BR")}`,
    arquivo_path: path,
    arquivo_nome: input.arquivo.name,
    observacao: input.justificativa.trim(),
    enviado_por: userData.user?.id ?? null,
  });
  if (error) {
    await supabase.storage.from("documentos").remove([path]);
    return { error: "Não foi possível vincular o documento à falta. Tente anexar novamente." };
  }
  return { error: null };
}
