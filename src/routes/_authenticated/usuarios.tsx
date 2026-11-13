import { pageHead } from "@/lib/page-head";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { resetDriverPassword } from "@/lib/accounts.functions";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => pageHead("Usuários", "Gestão autorizada de acessos ao sistema."), component: UsersPage });

const ROLES = ["administrador", "operacional", "consulta", "conferente", "financeiro", "motorista"] as const;

function UsersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const reset = useServerFn(resetDriverPassword);
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
      const { error } = await supabase.rpc("gerenciar_acesso", { _user: userId, _status: "ativo", _role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["users-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas-link"],
    queryFn: async () => (await supabase.from("motoristas").select("id,nome,user_id").order("nome")).data ?? [],
  });
  const link = useMutation({
    mutationFn: async ({ userId, motoristaId }: { userId: string; motoristaId: string }) => {
      const { error: e1 } = await supabase.from("motoristas").update({ user_id: null }).eq("user_id", userId);
      if (e1) throw e1;
      if (motoristaId !== "none") { const { error } = await supabase.from("motoristas").update({ user_id: userId }).eq("id", motoristaId); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Vínculo atualizado"); qc.invalidateQueries({ queryKey: ["motoristas-link"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Gestão de acessos e perfis" />
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="table-erp">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Criado em</th><th>Perfil</th><th>Motorista vinculado</th><th>Acesso</th><th>Recuperação</th></tr></thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td className="font-mono text-xs">{u.email}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  <Select value={u.roles[0]} onValueChange={(role) => setRole.mutate({ userId: u.id, role })}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Aprovar como…" /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td>
                  {u.roles[0] === "motorista" ? (
                    <Select value={motoristas.find((m: any) => m.user_id === u.id)?.id ?? "none"} onValueChange={(motoristaId) => link.mutate({ userId: u.id, motoristaId })}>
                      <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem vínculo</SelectItem>
                        {motoristas.filter((m: any) => !m.user_id || m.user_id === u.id).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : "—"}
                </td>
                <td><Select value={u.status_acesso} onValueChange={async status => { const { error } = await supabase.rpc("gerenciar_acesso", { _user: u.id, _status: status, _role: u.roles[0] ?? (u.tipo_acesso === "motorista" ? "motorista" : "consulta") }); if (error) toast.error(error.message); else { toast.success("Acesso atualizado"); qc.invalidateQueries(); } }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["pendente","ativo","inativo"].map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent></Select></td>
                <td>{u.tipo_acesso === "motorista" && <Button variant="outline" size="sm" onClick={async () => { const password = window.prompt("Nova senha (mínimo 8 caracteres). Confirme a identidade do motorista antes."); if (!password) return; const motivo = window.prompt("Justificativa da recuperação de acesso"); if (!motivo) return; try { await reset({ data: { userId: u.id, password, motivo } }); toast.success("Senha redefinida"); } catch { toast.error("Não foi possível redefinir a senha"); } }}>Redefinir senha</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
