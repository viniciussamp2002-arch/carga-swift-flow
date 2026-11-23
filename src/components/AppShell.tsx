import { Rows3, Rows4 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Home, Users, History, ShieldCheck, LogOut, UserCircle, Camera, FolderOpen, Truck, Building2, FileCheck, CalendarCheck } from "lucide-react";
import { AgendaBell } from "./AgendaBell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "./GlobalSearch";
import { MODULES } from "@/lib/modules";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isDriver, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [dense, setDense] = useState(false);
  useEffect(() => { const v = localStorage.getItem("tm-dense-tables") === "1"; setDense(v); document.documentElement.classList.toggle("dense-tables", v); }, []);
  const toggleDense = () => { const v = !dense; setDense(v); localStorage.setItem("tm-dense-tables", v ? "1" : "0"); document.documentElement.classList.toggle("dense-tables", v); };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  type NavItem = { to: string; label: string; icon: any; group: string };
  const items: NavItem[] = isDriver ? [{ to: "/motorista", label: "Meus canhotos", icon: Camera, group: "" }] : [
    { to: "/dashboard", label: "Início", icon: Home, group: "Operacional" },
    ...MODULES.map((m: any) => ({ ...m, group: "Operacional" })),
    { to: "/relatorios-recebimento", label: "Relatórios de Recebimento", icon: FileCheck, group: "Operacional" },
    { to: "/motorista", label: "Portal do Motorista", icon: Camera, group: "Operacional" },
    { to: "/notas-entregues", label: "Notas Entregues", icon: FileCheck, group: "Devoluções & Histórico" },
    { to: "/notas-devolucao", label: "Notas de Devolução", icon: FileCheck, group: "Devoluções & Histórico" },
    { to: "/estoque-devolucoes", label: "Estoque de Devoluções", icon: FolderOpen, group: "Devoluções & Histórico" },
    { to: "/arquivos-complementares", label: "Arquivos Complementares", icon: FolderOpen, group: "Devoluções & Histórico" },
    { to: "/historico", label: "Histórico", icon: History, group: "Devoluções & Histórico" },
    ...(isAdmin ? [{ to: "/usuarios", label: "Usuários", icon: ShieldCheck, group: "Cadastros" }] : []),
    { to: "/motoristas", label: "Motoristas", icon: Users, group: "Cadastros" },
    { to: "/veiculos", label: "Veículos", icon: Truck, group: "Cadastros" },
    { to: "/clientes-agendamento", label: "Clientes com Agendamento", icon: CalendarCheck, group: "Cadastros" },
    { to: "/fornecedores", label: "Fornecedores", icon: Building2, group: "Cadastros" },
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
           {!isDriver && <AgendaBell variant="header" />}
           {!isDriver && <Button size="icon" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={toggleDense} aria-label={dense ? "Visualização confortável" : "Visualização planilha (compacta)"} title={dense ? "Visualização confortável" : "Visualização planilha (compacta)"}>{dense ? <Rows3 className="h-5 w-5" /> : <Rows4 className="h-5 w-5" />}</Button>}
           <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-90">
            <UserCircle className="h-4 w-4" />{isDriver ? "Motorista" : user?.email}
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b"><SheetTitle className="text-primary">TRANSMERIDA</SheetTitle></SheetHeader>
          <nav className="p-2 space-y-0.5">
            {items.map((n, i) => {
              const header = n.group && n.group !== items[i - 1]?.group ? <div key={"g" + n.group} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{n.group}</div> : null;
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              const link = (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"}`}>
                  <n.icon className="h-4 w-4" />{n.label}
                </Link>
              );
              return header ? [header, link] : link;
            })}
          </nav>
          <div className="border-t p-3 mt-2">
            <div className="truncate text-xs text-muted-foreground mb-2">{isDriver ? "Motorista" : user?.email}</div>
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
