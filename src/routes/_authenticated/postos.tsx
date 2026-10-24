import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RequireModule, EmptyState } from "@/components/page";
import { useMe } from "@/lib/use-me";
import { canEditPostos } from "@/lib/labels";
import { geocodeEndereco } from "@/lib/geo.functions";

export const Route = createFileRoute("/_authenticated/postos")({
  head: () => ({ meta: [{ title: "Postos de serviço — Grupo Confidence" }] }),
  component: () => <RequireModule module="postos"><Postos /></RequireModule>,
});

type P = { id?: string; nome: string; cliente: string; tipo: string; endereco: string; cidade: string; efetivo_previsto: number; supervisor_id: string; ativo: boolean; observacoes: string; latitude: number | null; longitude: number | null; raio_metros: number };
const EMPTY: P = { nome: "", cliente: "", tipo: "Shopping", endereco: "", cidade: "", efetivo_previsto: 0, supervisor_id: "", ativo: true, observacoes: "", latitude: null, longitude: null, raio_metros: 150 };

function Postos() {
  const { data: me } = useMe();
  const canEdit = canEditPostos(me?.roles ?? []);
  const [editing, setEditing] = useState<P | null>(null);
  const { data } = useQuery({
    queryKey: ["postos"],
    queryFn: async () => {
      const [{ data: postos }, { data: colabs }, { data: sups }] = await Promise.all([
        supabase.from("postos").select("*").order("nome"),
        supabase.from("colaboradores").select("posto_id").eq("arquivado", false).eq("situacao", "ativo"),
        supabase.from("user_roles").select("user_id, profiles:user_id(nome)").eq("role", "supervisor"),
      ]);
      return { postos: postos ?? [], colabs: colabs ?? [], sups: (sups ?? []) as unknown as { user_id: string; profiles: { nome: string } | null }[] };
    },
  });
  const supName = (id: string | null) => data?.sups.find((s) => s.user_id === id)?.profiles?.nome;

  return (
    <div>
      <PageHeader title="Postos de serviço" description="Locais atendidos, efetivo e supervisão"
        actions={canEdit && <Button onClick={() => setEditing(EMPTY)}><Plus className="mr-1 h-4 w-4" />Novo posto</Button>} />
      {!data?.postos.length ? <EmptyState text="Nenhum posto cadastrado." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.postos.map((p) => {
            const n = data.colabs.filter((c) => c.posto_id === p.id).length;
            const low = n < p.efetivo_previsto;
            return (
              <Card key={p.id} className={!p.ativo ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-display font-semibold">{p.nome}</div><div className="text-sm text-muted-foreground">{p.cliente || "—"} · {p.tipo || "—"}</div></div>
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => setEditing({ ...EMPTY, ...p, cliente: p.cliente ?? "", tipo: p.tipo ?? "", endereco: p.endereco ?? "", cidade: p.cidade ?? "", supervisor_id: p.supervisor_id ?? "", observacoes: p.observacoes ?? "" })}><Pencil className="h-4 w-4" /></Button>}
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div className="text-sm"><div className="text-muted-foreground">Supervisor</div>{supName(p.supervisor_id) ?? "Não definido"}</div>
                    <div className={`text-right font-display text-2xl font-semibold ${low ? "text-warning" : ""}`}>{n}<span className="text-sm text-muted-foreground">/{p.efetivo_previsto}</span></div>
                  </div>
                  {!p.ativo && <div className="mt-2 text-xs">Inativo</div>}
                  <div className={`mt-2 text-xs ${p.latitude != null ? "text-muted-foreground" : "text-warning"}`}>
                    {p.latitude != null ? `Ponto por GPS: raio de ${p.raio_metros} m` : "Ponto por GPS não configurado"}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <PostoDialog value={editing} sups={data?.sups ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PostoDialog({ value, sups, onClose }: { value: P; sups: { user_id: string; profiles: { nome: string } | null }[]; onClose: () => void }) {
  const [f, setF] = useState(value);
  const [localizando, setLocalizando] = useState(false);
  const qc = useQueryClient();

  async function localizar() {
    if (!f.endereco.trim()) { toast.error("Preencha o endereço para localizar."); return; }
    setLocalizando(true);
    const r = await geocodeEndereco({ data: { endereco: f.endereco, cidade: f.cidade } });
    setLocalizando(false);
    if (!r) { toast.error("Endereço não encontrado. Confira o endereço e a cidade."); return; }
    setF((prev) => ({ ...prev, latitude: r.lat, longitude: r.lng }));
    toast.success("Localização encontrada: " + r.descricao);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { nome: f.nome.trim(), cliente: f.cliente || null, tipo: f.tipo || null, endereco: f.endereco || null, cidade: f.cidade || null,
      efetivo_previsto: Math.max(0, Number(f.efetivo_previsto) || 0), supervisor_id: f.supervisor_id || null, ativo: f.ativo, observacoes: f.observacoes || null,
      latitude: f.latitude, longitude: f.longitude, raio_metros: Math.max(20, Number(f.raio_metros) || 150) };
    const { error } = f.id ? await supabase.from("postos").update(payload).eq("id", f.id) : await supabase.from("postos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Posto salvo.");
    qc.invalidateQueries();
    onClose();
  }
  const inp = (k: keyof P, label: string, type = "text") => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={f[k] as string | number} required={k === "nome"} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{f.id ? "Editar posto" : "Novo posto"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {inp("nome", "Nome do posto *")}{inp("cliente", "Cliente")}{inp("tipo", "Tipo")}{inp("cidade", "Cidade")}
          {inp("endereco", "Endereço")}{inp("efetivo_previsto", "Efetivo previsto", "number")}
          <div className="space-y-1.5"><Label>Supervisor responsável</Label>
            <Select value={f.supervisor_id || "none"} onValueChange={(v) => setF({ ...f, supervisor_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Não definido</SelectItem>{sups.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.profiles?.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /><Label>Posto ativo</Label></div>
          <div className="space-y-1.5"><Label>Raio permitido p/ ponto (metros)</Label>
            <Input type="number" min={20} value={f.raio_metros} onChange={(e) => setF({ ...f, raio_metros: Number(e.target.value) })} /></div>
          <div className="space-y-1.5">
            <Label>Localização do ponto (GPS)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={localizar} disabled={localizando}>
                <MapPin className="mr-1 h-4 w-4" />{localizando ? "Localizando…" : "Localizar endereço"}
              </Button>
              {f.latitude != null && <span className="text-xs text-muted-foreground">{f.latitude.toFixed(5)}, {f.longitude?.toFixed(5)}</span>}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
