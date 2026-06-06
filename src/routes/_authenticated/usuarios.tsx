import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/usuarios")({ component: UsersPage });

const ROLES = ["administrador", "operacional", "consulta"] as const;

function UsersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const { data: users = [] } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: any) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["users-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Gestão de acessos e perfis" />
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="table-erp">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Criado em</th><th>Perfil</th></tr></thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td className="font-mono text-xs">{u.email}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  <Select value={u.roles[0] ?? "consulta"} onValueChange={(role) => setRole.mutate({ userId: u.id, role })}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
