import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => pageHead("Financeiro", "Tabelas de cobrança por contrato e apurações"),
  component: () => <ModulePlaceholder title="Financeiro" description="Tabelas de cobrança por contrato e apurações" items={["Cliente contratante","Período de apuração","Notas consideradas","Quantidade de entregas","Peso total","Regra aplicada","Valor calculado","Valor total do período"]} />,
});
