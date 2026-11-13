import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => pageHead("Relatórios", "Indicadores com filtros e exportação para Excel"),
  component: () => <ModulePlaceholder title="Relatórios" description="Indicadores com filtros e exportação para Excel" items={["Notas recebidas","Notas em depósito","Peso em estoque","Cargas expedidas","Entregas realizadas","Entregas pendentes","Entregas atrasadas","Ocorrências abertas","Produtividade por motorista","Faturamento calculado"]} />,
});
