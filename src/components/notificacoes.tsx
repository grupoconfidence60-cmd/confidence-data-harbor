import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificacoesBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: lista } = useQuery({
    queryKey: ["notificacoes"],
    refetchInterval: 30000,
    queryFn: async () =>
      (await supabase.from("notificacoes").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const naoLidas = (lista ?? []).filter((n) => !n.lida);

  async function abrir(id: string, link: string | null) {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notificacoes"] });
    if (link) navigate({ to: link });
  }

  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    qc.invalidateQueries({ queryKey: ["notificacoes"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {naoLidas.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {naoLidas.length > 9 ? "9+" : naoLidas.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {naoLidas.length > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={marcarTodas}>Marcar todas como lidas</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(lista ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            (lista ?? []).map((n) => (
              <button key={n.id} onClick={() => abrir(n.id, n.link)}
                className={`block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-accent ${n.lida ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  {!n.lida && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className="text-sm font-medium">{n.titulo}</span>
                </div>
                {n.mensagem && <div className="mt-0.5 text-xs text-muted-foreground">{n.mensagem}</div>}
                <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
