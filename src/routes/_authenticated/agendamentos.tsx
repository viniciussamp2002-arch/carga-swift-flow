import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => ({ meta: [{ title: "Agendamentos — Transmerida" }, { name: "description", content: "Agendamento de entregas das notas do depósito" }] }),
  component: () => <ModulePlaceholder title="Agendamentos" description="Agendamento de entregas das notas do depósito" items={["Número da nota","Cliente","Cidade","Fornecedor","Data de solicitação","Responsável","Data agendada","Horário","Local de entrega","Protocolo","Status","Observações"]} />,
});
