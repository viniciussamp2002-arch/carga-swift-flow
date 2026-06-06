import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  return <Navigate to={user ? "/dashboard" : "/auth"} replace />;
}
