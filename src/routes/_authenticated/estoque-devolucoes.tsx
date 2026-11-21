import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { returnsOptions } from "@/lib/returns-data";
import { ReturnsWorkspace } from "@/components/ReturnsWorkspace";
export const Route = createFileRoute("/_authenticated/estoque-devolucoes")({
  head: () => pageHead("Estoque de Devoluções", "Saldos físicos, pallets, reservas e retiradas de devoluções na Transmerida."),
  loader: ({ context }) => context.queryClient.ensureQueryData(returnsOptions),
  component: () => <ReturnsWorkspace stock />,
});
