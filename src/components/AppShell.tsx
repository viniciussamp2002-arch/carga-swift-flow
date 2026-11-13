import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Home, Users, History, ShieldCheck, LogOut, UserCircle, Camera, MoreVertical, FolderOpen, Truck, Building2, FileCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "./GlobalSearch";
import { MODULES } from "@/lib/modules";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isDriver, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = isDriver ? [{ to: "/motorista", label: "Meus canhotos", icon: Camera }] : [
    { to: "/dashboard", label: "Início", icon: Home },
    ...MODULES,
    { to: "/veiculos", label: "Veículos", icon: Users },
    { to: "/motoristas", label: "Motoristas", icon: Users },
    { to: "/motorista", label: "Portal do Motorista", icon: Camera },
    { to: "/historico", label: "Histórico", icon: History },
    ...(isAdmin ? [{ to: "/usuarios", label: "Usuários", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="bg-primary text-primary-foreground border-b-[3px] border-brand-accent">
        <div className="h-12 flex items-center gap-3 px-3">
          <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Link to={isDriver ? "/motorista" : "/dashboard"} className="font-bold tracking-wide">TRANSMERIDA</Link>
          <div className="flex-1 flex justify-center text-foreground">{!isDriver && <GlobalSearch />}</div>
           {!isDriver && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Mais opções"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to="/notas-entregues"><FileCheck className="h-4 w-4 mr-2" />Notas Entregues</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/arquivos-complementares"><FolderOpen className="h-4 w-4 mr-2" />Arquivos Complementares</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuLabel>Cadastros</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/motoristas"><Users className="h-4 w-4 mr-2" />Motoristas</Link></DropdownMenuItem>{isAdmin && <DropdownMenuItem asChild><Link to="/usuarios"><ShieldCheck className="h-4 w-4 mr-2" />Usuários</Link></DropdownMenuItem>}<DropdownMenuItem asChild><Link to="/fornecedores"><Building2 className="h-4 w-4 mr-2" />Fornecedores</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/veiculos"><Truck className="h-4 w-4 mr-2" />Veículos</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
           <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-90">
            <UserCircle className="h-4 w-4" />{user?.email}
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-3 border-b"><SheetTitle className="text-primary">TRANSMERIDA</SheetTitle></SheetHeader>
          <nav className="p-2 space-y-0.5">
            {items.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"}`}>
                  <n.icon className="h-4 w-4" />{n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-3 mt-2">
            <div className="truncate text-xs text-muted-foreground mb-2">{user?.email}</div>
            <Button size="sm" variant="outline" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5 mr-2" />Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}
