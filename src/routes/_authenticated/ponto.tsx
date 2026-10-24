import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/ponto")({
  head: () => ({ meta: [
    { title: "Meu ponto — Grupo Confidence" },
    { name: "description", content: "Registro pessoal de entrada e saída com localização Confidence." },
    { property: "og:title", content: "Meu ponto — Grupo Confidence" },
    { property: "og:description", content: "Registro pessoal de entrada e saída com localização Confidence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RequireModule module="ponto"><PontoTabs /></RequireModule>,
});

const hoje = () => new Date().toISOString().slice(0, 10);
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");

function PontoTabs() {
  const { data: me } = useMe();
  const gestao = (me?.roles ?? []).some((r) => ["admin", "gestor", "rh", "supervisor"].includes(r));
  if (!gestao) return <Ponto />;
  return (
    <Tabs defaultValue="registros">
      <TabsList className="mb-4">
        <TabsTrigger value="registros">Registros dos colaboradores</TabsTrigger>
        <TabsTrigger value="meu">Meu ponto</TabsTrigger>
      </TabsList>
      <TabsContent value="registros"><RegistrosEquipe /></TabsContent>
      <TabsContent value="meu"><Ponto /></TabsContent>
    </Tabs>
  );
}

function RegistrosEquipe() {
  const [dia, setDia] = useState(hoje);
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["ponto-equipe", dia],
    queryFn: async () => {
      const { data, error } = await supabase.from("presencas")
        .select("id, data, status, hora_entrada, hora_saida, distancia_metros, colaboradores(nome, matricula), postos(nome)")
        .eq("data", dia).not("hora_entrada", "is", null).order("hora_entrada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });
  const lista = (data ?? []).filter((r) => {
    const c = r.colaboradores as { nome: string; matricula: string } | null;
    const t = busca.trim().toLowerCase();
    return !t || c?.nome.toLowerCase().includes(t) || c?.matricula.includes(t);
  });
  return (
    <div>
      <PageHeader title="Registros de ponto" description="Entradas e saídas marcadas pelos colaboradores" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" className="w-44" value={dia} onChange={(e) => setDia(e.target.value || hoje())} />
        <Input className="w-64" placeholder="Buscar nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : lista.length === 0 ? <EmptyState text="Nenhum ponto marcado neste dia." /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Matrícula</TableHead><TableHead>Colaborador</TableHead><TableHead>Posto</TableHead>
              <TableHead>Entrada</TableHead><TableHead>Saída</TableHead><TableHead>Distância</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.map((r) => {
                const c = r.colaboradores as { nome: string; matricula: string } | null;
                const p = r.postos as { nome: string } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{c?.matricula ?? "—"}</TableCell>
                    <TableCell className="font-medium">{c?.nome ?? "—"}</TableCell>
                    <TableCell>{p?.nome ?? "—"}</TableCell>
                    <TableCell>{hora(r.hora_entrada)}</TableCell>
                    <TableCell>{hora(r.hora_saida)}</TableCell>
                    <TableCell>{r.distancia_metros != null ? `${Math.round(r.distancia_metros)} m` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}

function Ponto() {
  const qc = useQueryClient();
  const [marcando, setMarcando] = useState(false);
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
  const proximo: "entrada" | "saida" | null = !p?.hora_entrada ? "entrada" : !p?.hora_saida ? "saida" : null;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Meu ponto" description={`${data.colab.nome}${posto ? ` · ${posto}` : ""}`} />
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center">
          <Relogio />
          <button
            type="button"
            disabled={!proximo || marcando}
            onClick={async () => { if (!proximo) return; setMarcando(true); try { await bater(proximo); } finally { setMarcando(false); } }}
            className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg ring-8 ring-primary/20 transition active:scale-95 disabled:opacity-60"
          >
            <Fingerprint className="h-14 w-14" />
            <span className="text-lg font-bold">{marcando ? "Marcando…" : proximo ? "Marcar ponto" : "Ponto completo"}</span>
            {proximo && <span className="text-xs opacity-80">{proximo === "entrada" ? "Entrada" : "Saída"}</span>}
          </button>
          <div className="flex gap-8">
            <div><div className="text-xs text-muted-foreground">Entrada</div><div className="text-2xl font-bold">{hora(p?.hora_entrada ?? null)}</div></div>
            <div><div className="text-xs text-muted-foreground">Saída</div><div className="text-2xl font-bold">{hora(p?.hora_saida ?? null)}</div></div>
          </div>
          {postoInfo?.latitude != null && (
            <div className="text-xs text-muted-foreground">Ponto permitido dentro de {postoInfo.raio_metros} m do posto.</div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Meus pontos marcados</h2>
      {data.historico.length === 0 ? <EmptyState text="Nenhum ponto marcado ainda." /> : (
        <div className="grid gap-2">
          {data.historico.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-4 p-3">
                <span className="font-medium">{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                <div className="text-sm text-muted-foreground">
                  <LogIn className="mr-1 inline h-3 w-3" />{hora(r.hora_entrada)}
                  <LogOut className="ml-3 mr-1 inline h-3 w-3" />{hora(r.hora_saida)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => { setAgora(new Date()); const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div>
      <div className="text-sm capitalize text-muted-foreground">
        {agora?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
      </div>
      <div className="text-5xl font-bold tabular-nums">{agora?.toLocaleTimeString("pt-BR") ?? "--:--:--"}</div>
    </div>
  );
}
