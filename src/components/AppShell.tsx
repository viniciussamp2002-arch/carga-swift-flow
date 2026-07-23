import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, PackagePlus, Truck, Users, ClipboardCheck,
  History, ShieldCheck, LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./GlobalSearch";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notas", label: "Notas Fiscais", icon: FileText },
  { to: "/cargas", label: "Cargas", icon: PackagePlus },
  { to: "/entregas", label: "Entregas", icon: ClipboardCheck },
  { to: "/veiculos", label: "Veículos", icon: Truck },
  { to: "/motoristas", label: "Motoristas", icon: Users },
  { to: "/historico", label: "Histórico", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-screen w-full bg-background">
      <aside className="flex w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">Cross-Docking</div>
          <div className="text-base font-bold text-sidebar-primary-foreground">TMS Operacional</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/usuarios"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] mt-4 ${
                pathname.startsWith("/usuarios")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Usuários
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs">
          <div className="truncate text-sidebar-foreground/75 mb-2">{user?.email}</div>
          <Button size="sm" variant="secondary" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5 mr-2" />Sair
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3">
          <GlobalSearch />
        </header>
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
