import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, MapPin, Briefcase, UserCog, ScrollText, LogOut, Moon, Sun, ClipboardCheck, Palmtree, AlertTriangle, FileBarChart, FolderOpen, Clock, ClipboardList, Search, ChevronRight, Megaphone, Package, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";
import { NotificacoesBell } from "@/components/notificacoes";
import { useMe } from "@/lib/use-me";
import { canAccess, ROLE_LABELS } from "@/lib/labels";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { touchLastAccess } from "@/lib/users.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Tolerante a falhas de armazenamento/rede (comum no Safari do iPhone):
    // sem usuário válido, volta para o login em vez de quebrar a página.
    const user = await supabase.auth.getUser().then(
      ({ data }) => data.user,
      () => null,
    );
    if (!user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard, mod: "painel" },
  { to: "/ponto", label: "Meu ponto", icon: Clock, mod: "ponto" },
  { to: "/colaboradores", label: "Colaboradores", icon: Users, mod: "colaboradores" },
  { to: "/postos", label: "Postos de serviço", icon: MapPin, mod: "postos" },
  { to: "/funcoes", label: "Funções", icon: Briefcase, mod: "funcoes" },
  { to: "/presenca", label: "Presença e faltas", icon: ClipboardCheck, mod: "presenca" },
  { to: "/ferias", label: "Férias", icon: Palmtree, mod: "ferias" },
  { to: "/ocorrencias", label: "Solicitações", icon: AlertTriangle, mod: "ocorrencias" },
  { to: "/visitas", label: "Visitas de supervisão", icon: ClipboardList, mod: "visitas" },
  { to: "/inspecoes", label: "Checklists de inspeção", icon: ListChecks, mod: "inspecoes" },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, mod: "relatorios" },
  { to: "/documentos", label: "Documentos", icon: FolderOpen, mod: "documentos" },
  { to: "/materiais", label: "Equipamentos e uniformes", icon: Package, mod: "materiais" },
  { to: "/comunicados", label: "Comunicados", icon: Megaphone, mod: "comunicados" },
  { to: "/usuarios", label: "Usuários e acessos", icon: UserCog, mod: "usuarios" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, mod: "auditoria" },
] as const;

function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  const roles = me?.roles ?? [];
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const visibleNav = NAV.filter((n) => canAccess(roles, n.mod));
  const currentPage = loc.pathname.startsWith("/posto/") ? "Detalhes do posto" : NAV.find((n) => loc.pathname.startsWith(n.to))?.label ?? "Colaborador";
  const groups = [
    { label: "Visão geral", modules: ["painel", "ponto"] },
    { label: "Operação", modules: ["colaboradores", "postos", "presenca", "ocorrencias", "visitas", "inspecoes"] },
    { label: "Gestão", modules: ["ferias", "documentos", "materiais", "relatorios", "funcoes", "comunicados"] },
    { label: "Administração", modules: ["usuarios", "auditoria"] },
  ];
  useEffect(() => {
    try {
      const saved = localStorage.getItem("confidence-theme") === "dark";
      setDark(saved);
      document.documentElement.classList.toggle("dark", saved);
    } catch {
      setDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

  useEffect(() => { touchLastAccess().catch(() => {}); }, []);

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await qc.cancelQueries();
      qc.clear();
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Não foi possível concluir a saída da conta. Tente novamente.");
    }
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("confidence-theme", next ? "dark" : "light");
    } catch {
      toast.info("Tema aplicado, mas não foi possível salvar a preferência neste navegador.");
    }
  }

  return (
    <SidebarProvider className="workspace">
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border px-4 py-5"><BrandMark /></SidebarHeader>
          <SidebarContent className="py-3">
            {groups.map((group) => {
              const items = visibleNav.filter((n) => group.modules.includes(n.mod));
              if (!items.length) return null;
              return <SidebarGroup key={group.label} className="px-3 py-1">
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent><SidebarMenu>
                  {items.map((n) => <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={loc.pathname.startsWith(n.to)} tooltip={n.label}>
                      <Link to={n.to}><n.icon strokeWidth={1.7} /><span>{n.label}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
                </SidebarMenu></SidebarGroupContent>
              </SidebarGroup>;
            })}
          </SidebarContent>
          <SidebarFooter className="gap-3 border-t border-sidebar-border p-3">
            <div className="flex min-w-0 items-center gap-3 px-1 group-data-[collapsible=icon]:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-primary">{me?.profile?.nome?.slice(0, 2).toUpperCase() ?? "GC"}</div>
              <div className="min-w-0 text-xs">
                <div className="truncate font-semibold text-foreground">{me?.profile?.nome}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">{roles.map((r) => ROLE_LABELS[r]).join(", ") || "Sem perfil"}</div>
              </div>
            </div>
            <SidebarMenu><SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sair"><LogOut /><span>Sair da conta</span></SidebarMenuButton>
            </SidebarMenuItem></SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-[72px] items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-7">
            <SidebarTrigger aria-label="Abrir ou recolher menu" />
            <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><span>Confidence</span><ChevronRight className="h-3 w-3" /><span className="font-medium text-foreground">{currentPage}</span></div>
            <div className="flex-1" />
            <Button variant="outline" className="h-9 gap-2 text-muted-foreground sm:w-48 sm:justify-start" onClick={() => setSearchOpen(true)} aria-label="Buscar módulo"><Search /><span className="hidden sm:inline">Buscar módulo</span></Button>
            <div className="mx-1 hidden h-5 border-l sm:block" />
            <NotificacoesBell />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Alternar tema" aria-pressed={dark}>
              {dark ? <Sun /> : <Moon />}
            </Button></TooltipTrigger><TooltipContent>{dark ? "Tema claro" : "Tema escuro"}</TooltipContent></Tooltip>
            <span className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold sm:flex">{me?.profile?.nome?.slice(0, 2).toUpperCase() ?? "GC"}</span>
          </header>
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent className="overflow-hidden p-0">
              <DialogTitle className="sr-only">Buscar módulo</DialogTitle><DialogDescription className="sr-only">Módulos disponíveis para sua conta.</DialogDescription>
              <Command><CommandInput placeholder="Buscar módulo..." /><CommandList><CommandEmpty>Nenhum módulo encontrado.</CommandEmpty>
                <CommandGroup heading="Módulos">{visibleNav.map((n) => <CommandItem key={n.to} value={n.label} onSelect={() => { setSearchOpen(false); navigate({ to: n.to }); }}><n.icon /><span>{n.label}</span><ChevronRight className="ml-auto" /></CommandItem>)}</CommandGroup>
              </CommandList></Command>
            </DialogContent>
          </Dialog>
          <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-7 lg:p-8">
            {me && roles.length === 0 ? (
              <div className="mx-auto mt-20 max-w-md text-center">
                <h1 className="text-xl font-semibold">Acesso pendente</h1>
                <p className="mt-2 text-sm text-muted-foreground">Sua conta ainda não foi liberada pela administração ou está inativa.</p>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
