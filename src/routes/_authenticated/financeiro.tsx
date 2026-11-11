import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Transmerida" }, { name: "description", content: "Tabelas de cobrança por contrato e apurações" }] }),
  component: () => <ModulePlaceholder title="Financeiro" description="Tabelas de cobrança por contrato e apurações" items={["Cliente contratante","Período de apuração","Notas consideradas","Quantidade de entregas","Peso total","Regra aplicada","Valor calculado","Valor total do período"]} />,
});
