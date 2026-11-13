import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { user, loading, isDriver, accessStatus, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (accessStatus !== "ativo") return <div className="p-8"><h1 className="text-lg font-bold">Acesso {accessStatus === "pendente" ? "aguardando aprovação" : "inativo"}</h1><p className="my-3">Entre em contato com o escritório.</p><Button onClick={signOut}>Sair</Button></div>;
  if (isDriver && pathname !== "/motorista") return <Navigate to="/motorista" replace />;
  return <AppShell><Outlet /></AppShell>;
}
