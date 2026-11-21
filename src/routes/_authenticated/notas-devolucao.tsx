import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { returnsOptions } from "@/lib/returns-data";
import { ReturnsWorkspace } from "@/components/ReturnsWorkspace";
export const Route = createFileRoute("/_authenticated/notas-devolucao")({
  head: () => pageHead("Notas de Devolução", "Análise documental, produtos, lotes e recebimento de devoluções da Transmerida."),
  loader: ({ context }) => context.queryClient.ensureQueryData(returnsOptions),
  component: () => <ReturnsWorkspace />,
});
