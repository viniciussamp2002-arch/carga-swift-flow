import { pageHead } from "@/lib/page-head";
import { OcorrenciaBadge } from "@/components/Ocorrencias";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CARGA_STATUS_LABEL, NOTA_STATUS_COLOR, NOTA_STATUS_LABEL,
  fmtDate, fmtDateTime, fmtKg, fmtNum,
} from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cargas/$id")({
  head: () => pageHead("Detalhes da Carga", "Notas, motorista e veículo da carga de saída."), component: CargaDetail });

function CargaDetail() {
  const { id } = Route.useParams();
  const { data: carga } = useQuery({
    queryKey: ["carga", id],
    queryFn: async () => {
      const { data } = await supabase.from("cargas")
        .select("*, motoristas:motorista_id(nome,telefone), veiculos:veiculo_id(placa,modelo,marca)")
        .eq("id", id).single();
      return data;
    },
  });
  const { data: notas = [] } = useQuery({
    queryKey: ["carga-notas", id],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("carga_id", id)).data ?? [],
  });

  if (!carga) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;

  const totPeso = notas.reduce((s: number, n: any) => s + Number(n.peso || 0), 0);
  const totVol = notas.reduce((s: number, n: any) => s + Number(n.volumes || 0), 0);

  return (
    <div>
      <Link to="/cargas" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
        <ArrowLeft className="h-3 w-3" />Voltar
      </Link>
      <PageHeader
        title={`Carga #${carga.numero}`}
        subtitle={`Criada em ${fmtDateTime(carga.created_at)} • ${CARGA_STATUS_LABEL[carga.status]}`}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Info label="Motorista" value={carga.motoristas?.nome ?? "—"} sub={carga.motoristas?.telefone} />
        <Info label="Veículo" value={carga.veiculos?.placa ?? "—"} sub={`${carga.veiculos?.marca ?? ""} ${carga.veiculos?.modelo ?? ""}`} />
        <Info label="Data prevista" value={fmtDate(carga.data_prevista_saida)} />
        <Info label="Totais" value={`${notas.length} notas`} sub={`${fmtKg(totPeso)} • ${fmtNum(totVol)} vol`} />
      </div>

      <div className="bg-card border rounded-md overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">Notas vinculadas</div>
        <table className="table-erp">
          <thead>
            <tr>
              <th>Nº NF</th><th>Cliente</th><th>Cidade</th>
              <th className="text-right">Peso</th><th className="text-right">Vol</th><th>Status</th><th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n: any) => (
              <tr key={n.id}>
                <td className="font-mono">{n.numero}<OcorrenciaBadge nota={n} /></td>
                <td>{n.cliente}</td>
                <td>{n.cidade}/{n.uf}</td>
                <td className="text-right">{fmtKg(n.peso)}</td>
                <td className="text-right">{n.volumes}</td>
                <td><StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge></td>
                <td>
                  <Link to="/entregas" search={{ carga: id }}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Entregas</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 bg-card">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
