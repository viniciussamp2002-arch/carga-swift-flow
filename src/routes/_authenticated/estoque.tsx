import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Transmerida" }, { name: "description", content: "Mercadorias em depósito por fornecedor" }] }),
  component: () => <ModulePlaceholder title="Estoque" description="Mercadorias em depósito por fornecedor" items={["Notas em depósito","Peso total","Volumes","Valor total","Tempo de permanência","Por fornecedor","Por cidade","Por cliente"]} />,
});
