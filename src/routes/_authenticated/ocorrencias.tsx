import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => pageHead("Ocorrências", "Problemas relacionados às entregas"),
  component: () => <ModulePlaceholder title="Ocorrências" description="Problemas relacionados às entregas" items={["Nota fiscal","Cliente","Motorista","Tipo","Descrição","Data e horário","Responsável","Status","Solução adotada","Anexos"]} />,
});
