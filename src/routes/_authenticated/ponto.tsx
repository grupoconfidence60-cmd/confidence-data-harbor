import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { PRESENCA_LABELS } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/ponto")({
  head: () => ({ meta: [
    { title: "Meu ponto — Grupo Confidence" },
    { name: "description", content: "Registro pessoal de entrada e saída com localização Confidence." },
    { property: "og:title", content: "Meu ponto — Grupo Confidence" },
    { property: "og:description", content: "Registro pessoal de entrada e saída com localização Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="ponto"><Ponto /></RequireModule>,
});

const hoje = () => new Date().toISOString().slice(0, 10);
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");

function Ponto() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["meu-ponto"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { colab: null, hoje: null, historico: [] };
      const { data: colab } = await supabase
        .from("colaboradores").select("id, nome, posto_id, postos(nome, latitude, longitude, raio_metros)")
        .eq("user_id", uid).eq("arquivado", false).maybeSingle();
      if (!colab) return { colab: null, hoje: null, historico: [] };
      const [{ data: hojeRow }, { data: hist }] = await Promise.all([
        supabase.from("presencas").select("*").eq("colaborador_id", colab.id).eq("data", hoje()).maybeSingle(),
        supabase.from("presencas").select("*").eq("colaborador_id", colab.id)
          .order("data", { ascending: false }).limit(30),
      ]);
      return { colab, hoje: hojeRow, historico: hist ?? [] };
    },
  });

  function obterPosicao(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }),
    );
  }

  function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const rad = (g: number) => (g * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(a));
  }

  async function bater(tipo: "entrada" | "saida") {
    const colab = data?.colab;
    if (!colab) return;
    const posto = colab.postos as { nome: string; latitude: number | null; longitude: number | null; raio_metros: number } | null;

    let lat: number | null = null;
    let lng: number | null = null;
    let dist: number | null = null;

    if (posto?.latitude != null && posto.longitude != null) {
      let pos: GeolocationPosition;
      try {
        pos = await obterPosicao();
      } catch {
        toast.error("Não foi possível obter sua localização. Ative o GPS e permita o acesso à localização.");
        return;
      }
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      dist = Math.round(distanciaM(lat, lng, posto.latitude, posto.longitude));
      if (dist > posto.raio_metros) {
        toast.error(`Você está a ${dist} m do posto "${posto.nome}". O ponto só pode ser registrado dentro de ${posto.raio_metros} m.`);
        return;
      }
    }

    const agora = new Date().toISOString();
    if (tipo === "entrada") {
      const { error } = await supabase.from("presencas").insert({
        colaborador_id: colab.id, posto_id: colab.posto_id, data: hoje(),
        status: "presente", hora_entrada: agora, latitude: lat, longitude: lng, distancia_metros: dist,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Entrada registrada às " + hora(agora) + (dist != null ? ` (${dist} m do posto)` : ""));
    } else {
      if (!data?.hoje) return;
      const { error } = await supabase.from("presencas").update({ hora_saida: agora, latitude: lat, longitude: lng, distancia_metros: dist }).eq("id", data.hoje.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Saída registrada às " + hora(agora) + (dist != null ? ` (${dist} m do posto)` : ""));
    }
    qc.invalidateQueries({ queryKey: ["meu-ponto"] });
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.colab) {
    return (
      <div>
        <PageHeader title="Meu ponto" description="Registro de entrada e saída" />
        <EmptyState text="Sua conta ainda não está vinculada a um colaborador. Fale com o RH." />
      </div>
    );
  }

  const p = data.hoje;
  const postoInfo = data.colab.postos as { nome: string; latitude: number | null; raio_metros: number } | null;
  const posto = postoInfo?.nome;

  return (
    <div>
      <PageHeader title="Meu ponto" description={`${data.colab.nome}${posto ? ` · ${posto}` : ""}`} />
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </div>
          <div className="flex gap-8">
            <div>
              <div className="text-xs text-muted-foreground">Entrada</div>
              <div className="text-2xl font-bold">{hora(p?.hora_entrada ?? null)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saída</div>
              <div className="text-2xl font-bold">{hora(p?.hora_saida ?? null)}</div>
            </div>
          </div>
          {postoInfo?.latitude != null && (
            <div className="text-xs text-muted-foreground">Ponto permitido dentro de {postoInfo.raio_metros} m do posto — sua localização será registrada.</div>
          )}
          {!p?.hora_entrada ? (
            <Button size="lg" onClick={() => bater("entrada")}><LogIn className="mr-2 h-5 w-5" />Registrar entrada</Button>
          ) : !p?.hora_saida ? (
            <Button size="lg" variant="outline" onClick={() => bater("saida")}><LogOut className="mr-2 h-5 w-5" />Registrar saída</Button>
          ) : (
            <Badge variant="secondary" className="px-4 py-2 text-sm"><Clock className="mr-1 h-4 w-4" />Ponto do dia completo</Badge>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Histórico recente</h2>
      {data.historico.length === 0 ? <EmptyState text="Nenhum registro ainda." /> : (
        <div className="grid gap-2">
          {data.historico.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-4 p-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                  <Badge variant={r.status === "presente" ? "default" : r.status === "falta" ? "destructive" : "secondary"}>
                    {PRESENCA_LABELS[r.status]}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{hora(r.hora_entrada)} — {hora(r.hora_saida)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
