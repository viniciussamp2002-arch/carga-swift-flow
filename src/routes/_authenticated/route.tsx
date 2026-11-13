import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  const { user, loading, isDriver } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isDriver && pathname !== "/motorista") return <Navigate to="/motorista" replace />;
  return <AppShell><Outlet /></AppShell>;
}
