import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const tiposUniforme = [
  { id: "camisa", nome: "Camisa de vigia", tamanhos: ["2", "3", "4", "5", "6", "7", "8"] },
  { id: "usada", nome: "Camisa de vigia usada", tamanhos: ["2", "3", "6"] },
  { id: "calca", nome: "Calça", tamanhos: [] as string[] },
  { id: "blazer", nome: "Blazer feminino", tamanhos: [] as string[] },
];
type Material = { nome: string; tamanho: string };
export function tipoUniforme(nome: string) {
  const text = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (/\bcamisa\b/.test(text)) return /\busada\b/.test(text) ? "usada" : "camisa";
  if (/\bcalca\b/.test(text)) return "calca";
  if (/\bblazer\b/.test(text) && /\bfeminino\b/.test(text)) return "blazer";
  return "outro";
}
export function correspondeUniforme(item: Material, tipo: string, tamanho: string) {
  return (tipo === "todos" || tipoUniforme(item.nome) === tipo) &&
    (tamanho === "todos" || (tamanho === "sem" ? !item.tamanho.trim() : item.tamanho.trim() === tamanho));
}
export function MaterialTipos({ items, tipo, tamanho, onTipo, onTamanho }: {
  items: Material[]; tipo: string; tamanho: string; onTipo: (value: string) => void; onTamanho: (value: string) => void;
}) {
  const tamanhos = [...new Set([
    ...(tiposUniforme.find((t) => t.id === tipo)?.tamanhos ?? []),
    ...items.filter((i) => tipo === "todos" || tipoUniforme(i.nome) === tipo).map((i) => i.tamanho.trim()).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  return <section className="mb-4 space-y-3 rounded-lg border bg-card p-4 text-foreground" aria-label="Tipos e tamanhos de materiais">
    <Tabs value={tipo} onValueChange={(value) => { onTipo(value); onTamanho("todos"); }}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="todos">Todos os materiais</TabsTrigger>
        {tiposUniforme.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.nome}</TabsTrigger>)}
      </TabsList>
    </Tabs>
    <div className="flex flex-wrap items-center gap-3">
      <Select value={tamanho} onValueChange={onTamanho}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Selecionar tamanho"><SelectValue placeholder="Selecionar tamanho" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tamanhos</SelectItem>
          {tamanhos.map((size) => <SelectItem key={size} value={size}>Tamanho {size}</SelectItem>)}
          <SelectItem value="sem">Sem tamanho informado</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Selecione o tipo e o tamanho para consultar os materiais cadastrados.</p>
    </div>
  </section>;
}
