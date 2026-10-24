import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequireModule } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditColaboradores } from "@/lib/labels";
import { escalaLabel } from "@/lib/escala-options";
import { ColabDialog, SituacaoBadge, type ColabForm } from "./colaboradores";

export const Route = createFileRoute("/_authenticated/colaborador/$id")({
  head: () => ({ meta: [
    { title: "Colaborador — Grupo Confidence" },
    { name: "description", content: "Cadastro e histórico individual do colaborador Confidence." },
    { property: "og:title", content: "Colaborador — Grupo Confidence" },
    { property: "og:description", content: "Cadastro e histórico individual do colaborador Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="colaboradores"><Detalhe /></RequireModule>,
});

function Detalhe() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const canEdit = canEditColaboradores(me?.roles ?? []);
  const [editing, setEditing] = useState<ColabForm | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["colaborador", id],
    queryFn: async () => {
      const [{ data: c }, { data: h }] = await Promise.all([
        supabase.from("colaboradores").select("*, funcoes(nome), postos(nome)").eq("id", id).maybeSingle(),
        supabase.from("colaborador_historico").select("*").eq("colaborador_id", id).order("created_at", { ascending: false }),
      ]);
      return { c, h: h ?? [] };
    },
  });
  const c = data?.c;
  if (!data) return null;
  if (!c) return <p className="text-muted-foreground">Colaborador não encontrado ou sem permissão.</p>;

  async function arquivar() {
    if (!confirm("Arquivar este colaborador? Ele deixará de aparecer nas listas.")) return;
    const { error } = await supabase.from("colaboradores").update({ arquivado: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador arquivado.");
    qc.invalidateQueries();
    navigate({ to: "/colaboradores" });
  }

  const info: [string, string | null | undefined][] = [
    ["Matrícula", c.matricula], ["CPF", c.cpf], ["Telefone", c.telefone], ["E-mail", c.email],
    ["Função", c.funcoes?.nome], ["Posto", c.postos?.nome], ["Admissão", c.data_admissao && new Date(c.data_admissao + "T00:00").toLocaleDateString("pt-BR")],
    ["Vínculo", c.vinculo], ["Jornada", c.jornada ? escalaLabel(c.jornada) : null], ["Endereço", c.endereco],
  ];

  return (
    <div className="space-y-4">
      <Link to="/colaboradores" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Colaboradores</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{c.nome}</h1><SituacaoBadge s={c.situacao} /></div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={arquivar}><Archive className="mr-1 h-4 w-4" />Arquivar</Button>
            <Button onClick={() => setEditing({
              id: c.id, matricula: c.matricula, nome: c.nome, cpf: c.cpf ?? "", telefone: c.telefone ?? "", email: c.email ?? "",
              endereco: c.endereco ?? "", funcao_id: c.funcao_id ?? "", posto_id: c.posto_id ?? "", data_admissao: c.data_admissao ?? "",
              vinculo: c.vinculo ?? "", jornada: c.jornada ?? "", situacao: c.situacao, observacoes: c.observacoes ?? "",
            })}><Pencil className="mr-1 h-4 w-4" />Editar / transferir</Button>
          </div>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Dados cadastrais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {info.map(([k, v]) => <div key={k}><div className="text-xs text-muted-foreground">{k}</div><div className="text-sm">{v || "—"}</div></div>)}
            {c.observacoes && canEdit && <div className="sm:col-span-2"><div className="text-xs text-muted-foreground">Observações</div><div className="text-sm whitespace-pre-wrap">{c.observacoes}</div></div>}
          </CardContent>
        </Card>
        {canEdit && <ContaAcesso colabId={c.id} userId={c.user_id} />}
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l pl-4">
              {data.h.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-accent" />
                  <div className="text-sm">{h.descricao}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      {editing && <ColabDialog value={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ContaAcesso({ colabId, userId }: { colabId: string; userId: string | null }) {
  const qc = useQueryClient();
  const { data: contas } = useQuery({
    queryKey: ["contas-colaborador"],
    queryFn: async () => {
      const [{ data: r }, { data: p }, { data: v }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "colaborador"),
        supabase.from("profiles").select("id, nome, email").order("nome"),
        supabase.from("colaboradores").select("id, user_id").not("user_id", "is", null),
      ]);
      const ids = new Set((r ?? []).map((x) => x.user_id));
      return (p ?? []).filter((x) => ids.has(x.id)).map((x) => ({ ...x, usadoPor: (v ?? []).find((y) => y.user_id === x.id)?.id }));
    },
  });
  async function vincular(v: string) {
    const { error } = await supabase.from("colaboradores").update({ user_id: v === "none" ? null : v }).eq("id", colabId);
    if (error) { toast.error(error.message); return; }
    toast.success(v === "none" ? "Conta desvinculada." : "Conta vinculada. O colaborador já pode bater ponto.");
    qc.invalidateQueries();
  }
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-base">Conta de acesso (ponto e ocorrências)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Select value={userId ?? "none"} onValueChange={vincular}>
          <SelectTrigger className="max-w-md" aria-label="Conta de acesso"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem conta vinculada</SelectItem>
            {(contas ?? []).filter((x) => !x.usadoPor || x.usadoPor === colabId).map((x) => <SelectItem key={x.id} value={x.id}>{x.nome} · {x.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Mostra usuários com perfil Colaborador (crie em Usuários). Sem vínculo, o colaborador não consegue bater ponto.</p>
      </CardContent>
    </Card>
  );
}
