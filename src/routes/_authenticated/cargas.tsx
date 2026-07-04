import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { CARGA_STATUS_LABEL, fmtDate, fmtKg, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cargas")({ component: CargasPage });

const STATUS_COLOR: Record<string, string> = {
  separacao: "bg-warning/15 text-warning-foreground border-warning/40",
  carregamento: "bg-warning/25 text-warning-foreground border-warning/50",
  em_rota: "bg-primary/15 text-primary border-primary/30",
  finalizada: "bg-success/15 text-success border-success/30",
};

function CargasPage() {
  const { canWrite } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: cargas = [] } = useQuery({
    queryKey: ["cargas"],
    queryFn: async () => (await supabase.from("cargas")
      .select("*, motoristas:motorista_id(nome), veiculos:veiculo_id(placa), notas_fiscais(id, peso, volumes)")
      .order("numero", { ascending: false })).data ?? [],
  });

  const updStatus = useMutation({
    mutationFn: async ({ id, status, numero }: any) => {
      const { error } = await supabase.from("cargas").update({ status }).eq("id", id);
      if (error) throw error;
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

  const columns: DataTableColumn<any>[] = useMemo(() => [
    { key: "numero", header: "#", accessor: (c) => c.numero, render: (c) => <span className="font-mono font-semibold">#{c.numero}</span> },
    { key: "data", header: "Data", accessor: (c) => c.created_at, render: (c) => fmtDate(c.created_at) },
    { key: "motorista", header: "Motorista", accessor: (c) => c.motoristas?.nome ?? "" },
    { key: "veiculo", header: "Veículo", accessor: (c) => c.veiculos?.placa ?? "", render: (c) => <span className="font-mono">{c.veiculos?.placa ?? "—"}</span> },
    { key: "notas", header: "Notas", accessor: (c) => c.notas_fiscais?.length ?? 0, align: "right" },
    {
      key: "peso", header: "Peso",
      accessor: (c) => c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.peso || 0), 0) ?? 0,
      align: "right",
      render: (c) => fmtKg(c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.peso || 0), 0) ?? 0),
    },
    {
      key: "volumes", header: "Vol",
      accessor: (c) => c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.volumes || 0), 0) ?? 0,
      align: "right",
      render: (c) => fmtNum(c.notas_fiscais?.reduce((s: number, n: any) => s + Number(n.volumes || 0), 0) ?? 0),
    },
    {
      key: "status", header: "Status", accessor: (c) => CARGA_STATUS_LABEL[c.status],
      render: (c) => <StatusBadge className={STATUS_COLOR[c.status]}>{CARGA_STATUS_LABEL[c.status]}</StatusBadge>,
    },
    {
      key: "acoes", header: "Ações", accessor: () => "", filterable: false, sortable: false,
      render: (c) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => nav({ to: "/cargas/$id", params: { id: c.id } })}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canWrite && c.status !== "finalizada" && (
            <Select onValueChange={(v) => updStatus.mutate({ id: c.id, status: v, numero: c.numero })}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Avançar..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(CARGA_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      ),
    },
  ], [canWrite, updStatus, nav]);

  return (
    <div>
      <PageHeader title="Cargas" subtitle={`${cargas.length} carga(s)`} />
      <DataTable
        data={cargas} columns={columns} rowKey={(c: any) => c.id}
        exportName="cargas"
        onRowClick={(c: any) => nav({ to: "/cargas/$id", params: { id: c.id } })}
      />
    </div>
  );
}
