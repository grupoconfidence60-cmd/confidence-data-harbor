import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export const materiaisQuery = queryOptions({
  queryKey: ["materiais"],
  queryFn: async () => {
    const [items, deliveries, people, posts] = await Promise.all([
      supabase.from("materiais").select("*").order("nome"),
      supabase.from("material_entregas").select("*").order("data_entrega", { ascending: false }),
      supabase.from("colaboradores").select("id,nome,matricula,posto_id,arquivado").order("nome"),
      supabase.from("postos").select("id,nome,ativo").order("nome"),
    ]);
    for (const result of [items, deliveries, people, posts]) if (result.error) throw result.error;
    return { items: items.data ?? [], deliveries: deliveries.data ?? [], people: people.data ?? [], posts: posts.data ?? [] };
  },
});
export function materiaisWorkbook(rows: (string | number)[][]) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Grupo Confidence — Equipamentos e uniformes"], ["Material", "Categoria", "Tamanho", "Identificação", "Matrícula", "Colaborador", "Posto", "Quantidade", "Entrega", "Devolução", "Condição", "Observações"], ...rows]);
  sheet["!cols"] = [30, 18, 12, 20, 12, 32, 28, 12, 16, 16, 18, 36].map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: `A2:L${rows.length + 2}` };
  XLSX.utils.book_append_sheet(book, sheet, "Entregas");
  return book;
}
export function baixarMateriais(rows: (string | number)[][]) {
  XLSX.writeFile(materiaisWorkbook(rows), "Confidence-Equipamentos-Uniformes.xlsx");
}