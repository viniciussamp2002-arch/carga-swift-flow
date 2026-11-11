import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/cargas-previstas")({
  head: () => ({ meta: [{ title: "Cargas Previstas — Transmerida" }, { name: "description", content: "Cargas que ainda chegarão à transportadora" }] }),
  component: () => <ModulePlaceholder title="Cargas Previstas" description="Cargas que ainda chegarão à transportadora" items={["Número do transporte","Fornecedor / embarcador","Transportadora de origem","Data prevista de chegada","Cidade de origem","Quantidade de notas","Peso total","Valor total","Status","Observações"]} />,
});
