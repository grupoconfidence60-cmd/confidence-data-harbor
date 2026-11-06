import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Normaliza telefone brasileiro para formato wa.me (só dígitos, com 55). */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

export function ComunicadoWhatsapp({ titulo, mensagem, onClose }: { titulo: string; mensagem: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [posto, setPosto] = useState("todos");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { data, isPending, isError } = useQuery({
    queryKey: ["whatsapp-colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores")
        .select("id,nome,telefone,situacao,postos(nome)").neq("situacao", "desligado").order("nome");
      if (error) throw error;
      return data as unknown as { id: string; nome: string; telefone: string | null; postos: { nome: string } | null }[];
    },
  });
  const postos = useMemo(() => [...new Set((data ?? []).map((c) => c.postos?.nome).filter(Boolean) as string[])].sort(), [data]);
  const list = (data ?? []).filter((c) => (posto === "todos" || c.postos?.nome === posto)
    && c.nome.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const text = encodeURIComponent(`*Comunicado Grupo Confidence*\n\n*${titulo}*\n\n${mensagem}`);

  function open(id: string, num: string) {
    window.open(`https://wa.me/${num}?text=${text}`, "_blank", "noopener");
    setSent((s) => new Set(s).add(id));
  }

  return <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto bg-background text-foreground">
      <DialogHeader><DialogTitle>Enviar pelo WhatsApp</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Clique em <b>Enviar</b> ao lado de cada colaborador. O WhatsApp abre com o comunicado pronto; é só apertar enviar.</p>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar colaborador" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select aria-label="Filtrar por posto" className="h-10 rounded-md border bg-background px-3 text-sm" value={posto} onChange={(e) => setPosto(e.target.value)}>
          <option value="todos">Todos os postos</option>
          {postos.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">{sent.size} enviado(s) nesta janela · {list.length} colaborador(es)</p>
      {isPending ? <p className="text-sm text-muted-foreground">Carregando…</p> : isError ? <p role="alert" className="text-destructive">Não foi possível carregar os colaboradores.</p> :
        <ul className="divide-y rounded-lg border">
          {list.map((c) => {
            const num = whatsappNumber(c.telefone);
            return <li key={c.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.postos?.nome ?? "Sem posto"} · {c.telefone || "sem telefone"}</p></div>
              {num ? <Button size="sm" variant={sent.has(c.id) ? "outline" : "default"} onClick={() => open(c.id, num)}>
                {sent.has(c.id) ? <><Check className="mr-1 h-4 w-4" />Enviado</> : <><MessageCircle className="mr-1 h-4 w-4" />Enviar</>}
              </Button> : <span className="text-xs text-muted-foreground">Telefone inválido</span>}
            </li>;
          })}
        </ul>}
    </DialogContent>
  </Dialog>;
}
