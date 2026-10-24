import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, MapPin, Briefcase, UserCog, ScrollText, LogOut, Moon, Sun, CalendarRange, ClipboardCheck, Palmtree, AlertTriangle, FileBarChart, FolderOpen, Clock, ClipboardList } from "lucide-react";
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
import { touchLastAccess } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard, mod: "painel" },
  { to: "/ponto", label: "Meu ponto", icon: Clock, mod: "ponto" },
  { to: "/colaboradores", label: "Colaboradores", icon: Users, mod: "colaboradores" },
  { to: "/postos", label: "Postos de serviço", icon: MapPin, mod: "postos" },
  { to: "/funcoes", label: "Funções", icon: Briefcase, mod: "funcoes" },
  { to: "/escalas", label: "Escalas", icon: CalendarRange, mod: "escalas" },
  { to: "/presenca", label: "Presença e faltas", icon: ClipboardCheck, mod: "presenca" },
  { to: "/ferias", label: "Férias", icon: Palmtree, mod: "ferias" },
  { to: "/ocorrencias", label: "Ocorrências", icon: AlertTriangle, mod: "ocorrencias" },
  { to: "/visitas", label: "Visitas de supervisão", icon: ClipboardList, mod: "visitas" },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, mod: "relatorios" },
  { to: "/documentos", label: "Documentos", icon: FolderOpen, mod: "documentos" },
  { to: "/usuarios", label: "Usuários e acessos", icon: UserCog, mod: "usuarios" },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText, mod: "auditoria" },
] as const;

function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  const roles = me?.roles ?? [];

  useEffect(() => { touchLastAccess().catch(() => {}); }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function toggleDark() { document.documentElement.classList.toggle("dark"); }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-4"><BrandMark /></SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Módulos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.filter((n) => canAccess(roles, n.mod)).map((n) => (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={loc.pathname.startsWith(n.to)} tooltip={n.label}>
                        <Link to={n.to}><n.icon /><span>{n.label}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="truncate px-1 text-xs">
              <div className="font-semibold">{me?.profile?.nome}</div>
              <div className="opacity-60">{roles.map((r) => ROLE_LABELS[r]).join(", ") || "Sem perfil"}</div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Sair"><LogOut /><span>Sair</span></SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificacoesBell />
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Alternar tema">
              <Sun className="hidden h-4 w-4 dark:block" /><Moon className="h-4 w-4 dark:hidden" />
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6">
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
