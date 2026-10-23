import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, RequireModule } from "@/components/page";

export const Route = createFileRoute("/_authenticated/funcoes")({
  head: () => ({ meta: [{ title: "Funções — Grupo Confidence" }] }),
  component: () => <RequireModule module="funcoes"><Funcoes /></RequireModule>,
});

function Funcoes() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["funcoes"],
    queryFn: async () => (await supabase.from("funcoes").select("*").order("nome")).data ?? [],
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("funcoes").insert({ nome: nome.trim(), descricao: desc || null });
    if (error) { toast.error(error.code === "23505" ? "Função já existe." : error.message); return; }
    setNome(""); setDesc(""); qc.invalidateQueries();
  }
  async function toggle(id: string, ativo: boolean) {
    const { error } = await supabase.from("funcoes").update({ ativo }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries();
  }
  return (
    <div>
      <PageHeader title="Funções operacionais" description="Cargos e funções usados nos cadastros" />
      <form onSubmit={add} className="mb-4 flex flex-wrap gap-2">
        <Input className="w-56" placeholder="Nova função" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input className="min-w-56 flex-1" placeholder="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button type="submit">Adicionar</Button>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Função</TableHead><TableHead>Descrição</TableHead><TableHead className="w-24">Ativa</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((f) => (
            <TableRow key={f.id}><TableCell className="font-medium">{f.nome}</TableCell><TableCell>{f.descricao}</TableCell>
              <TableCell><Switch checked={f.ativo} onCheckedChange={(v) => toggle(f.id, v)} /></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </div>
  );
}
