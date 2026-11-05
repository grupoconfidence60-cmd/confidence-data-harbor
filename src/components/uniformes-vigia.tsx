import { useState } from "react";
import { Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/page";

type Material = { id: string; nome: string; tamanho: string; identificacao: string };
const nomes = ["Camisa de Vigia", "Camisa de Vigia usada", "Blazer feminino", "Calça preta"];
const normalizar = (valor: string) => valor.trim().toLocaleLowerCase("pt-BR");

export function UniformesVigia({ items, onEntrega, entregaDisabled }: { items: Material[]; onEntrega: (id: string) => void; entregaDisabled: boolean }) {
  const grupos = nomes.map((nome) => ({
    nome,
    variantes: items.filter((item) => normalizar(item.nome) === normalizar(nome)).sort((a, b) => {
      const tamanhoA = a.tamanho.trim();
      const tamanhoB = b.tamanho.trim();
      if (!tamanhoA && tamanhoB) return 1;
      if (tamanhoA && !tamanhoB) return -1;
      return tamanhoA.localeCompare(tamanhoB, "pt-BR", { numeric: true }) || a.id.localeCompare(b.id);
    }),
  })).filter((grupo) => grupo.variantes.length > 0);

  return <section className="space-y-4 text-foreground">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">Uniformes de vigia</h2>
      <p className="text-sm text-muted-foreground">Selecione um tamanho cadastrado. Itens sem tamanho informado permanecem identificados dessa forma. A lista representa o cadastro, não a disponibilidade em estoque.</p>
    </div>
    {!grupos.length ? <EmptyState text="Nenhum uniforme de vigia encontrado." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {grupos.map((grupo) => <UniformeCard key={grupo.nome} {...grupo} onEntrega={onEntrega} entregaDisabled={entregaDisabled} />)}
    </div>}
  </section>;
}

function UniformeCard({ nome, variantes, onEntrega, entregaDisabled }: { nome: string; variantes: Material[]; onEntrega: (id: string) => void; entregaDisabled: boolean }) {
  const [materialId, setMaterialId] = useState("");
  const selecionado = variantes.find((item) => item.id === materialId);
  const selectId = `uniforme-tamanho-${variantes[0].id}`;
  return <article className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
    <div className="flex items-start gap-3">
      <Shirt className="h-6 w-6 shrink-0 text-primary" />
      <div className="min-w-0 space-y-2"><h3 className="break-words font-semibold">{nome}</h3><Badge variant="secondary">Destinado a vigias</Badge></div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={selectId}>Tamanho cadastrado</Label>
      <Select value={selecionado?.id ?? ""} onValueChange={setMaterialId}>
        <SelectTrigger id={selectId} className="w-full"><SelectValue placeholder="Selecione o tamanho" /></SelectTrigger>
        <SelectContent>{variantes.map((item) => <SelectItem key={item.id} value={item.id}>
          {item.tamanho.trim() || "Sem tamanho informado"}{item.identificacao.trim() ? ` · ${item.identificacao}` : ""}
        </SelectItem>)}</SelectContent>
      </Select>
    </div>
    <Button className="mt-auto w-full" disabled={!selecionado || entregaDisabled} onClick={() => { if (selecionado) onEntrega(selecionado.id); }}>Registrar entrega</Button>
  </article>;
}
