import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => pageHead("Histórico Operacional", "Rastreabilidade das movimentações logísticas."), component: HistPage });

function HistPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["historico"],
    queryFn: async () => (await supabase.from("historico")
      .select("*, profiles:user_id(nome, email)")
      .order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  return (
    <div>
      <PageHeader title="Histórico Operacional" subtitle="Todas as movimentações registradas" />
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="table-erp">
          <thead>
            <tr><th>Data / Hora</th><th>Entidade</th><th>Ação</th><th>Descrição</th><th>Usuário</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{fmtDateTime(r.created_at)}</td>
                <td className="uppercase text-xs">{r.entidade}</td>
                <td className="text-xs">{r.acao}</td>
                <td>{r.descricao}</td>
                <td className="text-xs text-muted-foreground">{r.profiles?.nome ?? r.profiles?.email ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sem registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
