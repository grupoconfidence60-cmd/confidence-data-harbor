import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, RequireModule } from "@/components/page";
import { PostoPlanilha } from "@/components/posto-planilha";

export const Route = createFileRoute("/_authenticated/posto/$id")({
  head: () => ({ meta: [
    { title: "Planilha do posto — Grupo Confidence" },
    { name: "description", content: "Planilha mensal por posto com escalas pares e ímpares da equipe Confidence." },
    { property: "og:title", content: "Planilha do posto — Grupo Confidence" },
    { property: "og:description", content: "Escalas mensais, colaboradores e exportação Excel por posto." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="postos"><Posto /></RequireModule>,
});
function Posto() {
  const { id } = Route.useParams();
  const { data, isPending, isError } = useQuery({ queryKey: ["posto", id], queryFn: async () => {
    const result = await supabase.from("postos").select("id,nome,cliente,endereco,cidade,supervisor_id,ativo").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  } });
  return <div className="min-w-0">
    <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/postos"><ArrowLeft className="h-4 w-4" />Postos de serviço</Link></Button>
    {isPending ? <p className="text-muted-foreground">Carregando posto…</p> : isError || !data ? <p role="alert" className="text-muted-foreground">Posto não encontrado ou acesso indisponível.</p> : <>
      <PageHeader title={data.nome} description={`${data.cliente ?? "Grupo Confidence"}${data.ativo ? "" : " · Inativo"}`} />
      <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span>{[data.endereco, data.cidade].filter(Boolean).join(" · ") || "Endereço não informado"}</span></div>
      <PostoPlanilha posto={data} />
    </>}
  </div>;
}