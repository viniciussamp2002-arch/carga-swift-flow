import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CARGA_STATUS_LABEL, fmtDate, fmtKg, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/cargas")({ component: CargasPage });

const STATUS_COLOR: Record<string, string> = {
  separacao: "bg-warning/15 text-warning-foreground border-warning/40",
  carregamento: "bg-warning/25 text-warning-foreground border-warning/50",
  em_rota: "bg-primary/15 text-primary border-primary/30",
  finalizada: "bg-success/15 text-success border-success/30",
};

function CargasPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const { data: cargas = [] } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cargas")
        .select("*, motoristas:motorista_id(nome), veiculos:veiculo_id(placa), notas_fiscais(id, peso, volumes)")
        .order("numero", { ascending: false });
      return data ?? [];
    },
  });

  const updStatus = useMutation({
    mutationFn: async ({ id, status, numero }: any) => {
      const { error } = await supabase.from("cargas").update({ status }).eq("id", id);
      if (error) throw error;
      // Atualiza status das notas conforme novo status da carga
      const notaStatusMap: Record<string, string> = {
        separacao: "separacao", carregamento: "carregamento",
        em_rota: "em_rota", finalizada: "em_rota",
      };
      if (notaStatusMap[status]) {
        await supabase.from("notas_fiscais")
          .update({ status: notaStatusMap[status] as any })
          .eq("carga_id", id)
          .in("status", ["separacao", "carregamento", "em_rota"]);
      }
      await supabase.from("historico").insert({
        entidade: "carga", entidade_id: id, acao: "status",
        descricao: `Carga #${numero} → ${CARGA_STATUS_LABEL[status]}`,
      });
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Cargas" subtitle={`${cargas.length} carga(s)`} />
      <div className="bg-card border rounded-md overflow-hidden">
        <div className="max-h-[calc(100vh-180px)] overflow-auto">
          <table className="table-erp">
            <thead>
              <tr>
                <th>#</th><th>Data</th><th>Motorista</th><th>Veículo</th>
                <th className="text-right">Notas</th>
                <th className="text-right">Peso</th>
                <th className="text-right">Volumes</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c: any) => {
                const totPeso = c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.peso || 0), 0) ?? 0;
                const totVol = c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.volumes || 0), 0) ?? 0;
                return (
                  <tr key={c.id}>
                    <td className="font-mono font-semibold">#{c.numero}</td>
                    <td>{fmtDate(c.created_at)}</td>
                    <td>{c.motoristas?.nome ?? "—"}</td>
                    <td className="font-mono">{c.veiculos?.placa ?? "—"}</td>
                    <td className="text-right">{c.notas_fiscais?.length ?? 0}</td>
                    <td className="text-right">{fmtKg(totPeso)}</td>
                    <td className="text-right">{fmtNum(totVol)}</td>
                    <td><StatusBadge className={STATUS_COLOR[c.status]}>{CARGA_STATUS_LABEL[c.status]}</StatusBadge></td>
                    <td className="flex gap-1.5">
                      <Link to="/cargas/$id" params={{ id: c.id }}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Abrir</Button>
                      </Link>
                      {canWrite && c.status !== "finalizada" && (
                        <Select onValueChange={(v) => updStatus.mutate({ id: c.id, status: v, numero: c.numero })}>
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue placeholder="Avançar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CARGA_STATUS_LABEL).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                );
              })}
              {cargas.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma carga gerada ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
