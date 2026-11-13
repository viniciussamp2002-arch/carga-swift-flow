import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OcorrenciaBadge, useOcorrencias } from "@/components/Ocorrencias";
import { OC_ETAPA_LABEL, OC_STATUS_LABEL, OC_TIPO_LABEL } from "@/lib/occurrence-rules";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => pageHead("Ocorrências", "Consulta de divergências e histórico permanente por nota fiscal."),
  component: OccurrencesPage,
});

function OccurrencesPage() {
  const map = useOcorrencias();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [stage, setStage] = useState("todas");
  const { data: notes = [], isPending, error } = useQuery({ queryKey: ["ocorrencias-notas"], queryFn: async () => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const result = await supabase.from("notas_fiscais").select("id, numero, cliente, fornecedor, chave_nfe, carga_entrada_id, carga_id, cargas_entrada(numero_transporte), cargas(numero)").order("id").range(from, from + 999);
      if (result.error) throw result.error;
      all.push(...(result.data ?? []));
      if (!result.data || result.data.length < 1000) break;
    }
    return all;
  }});
  const byId = new Map(notes.map(n => [n.id, n]));
  const rows = Array.from(map.values()).flat().filter(o => {
    const n = byId.get(o.nota_id);
    return (status === "todos" || status === o.status) && (stage === "todas" || stage === o.etapa) &&
      (!search.trim() || [n?.numero, n?.cliente, n?.fornecedor, o.descricao, o.resolucao].some(v => v?.toLowerCase().includes(search.trim().toLowerCase())));
  });
  return <div>
    <PageHeader title="Ocorrências" subtitle={`${rows.length} ocorrência(s)`} />
    <div className="flex flex-wrap gap-2 mb-3">
      <Input aria-label="Pesquisar ocorrências" className="max-w-sm" placeholder="NF, cliente, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
      <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtrar status" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(OC_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      <Select value={stage} onValueChange={setStage}><SelectTrigger aria-label="Filtrar etapa" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as etapas</SelectItem>{Object.entries(OC_ETAPA_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
    </div>
    {error && <p role="alert" className="text-destructive">Não foi possível consultar as notas fiscais.</p>}
    <div className="border rounded-md overflow-auto"><table className="table-erp"><thead><tr><th>NF / Histórico</th><th>Cliente</th><th>Carga</th><th>Etapa</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Responsável</th><th>Data e horário</th></tr></thead><tbody>
      {rows.map(o => { const n = byId.get(o.nota_id); return <tr key={o.id}><td>{n?.numero}<OcorrenciaBadge nota={n ?? { id: o.nota_id }} etapa={o.etapa} /></td><td>{n?.cliente || "—"}</td><td>{n?.cargas_entrada?.numero_transporte || (n?.cargas ? `#${n.cargas.numero}` : "—")}</td><td>{OC_ETAPA_LABEL[o.etapa]}</td><td>{OC_TIPO_LABEL[o.tipo]}</td><td className="max-w-xs whitespace-pre-wrap break-words">{o.descricao}</td><td>{OC_STATUS_LABEL[o.status]}</td><td>{o.registrado_por_nome || "—"}</td><td>{fmtDateTime(o.data_ocorrencia)}</td></tr>; })}
      {!rows.length && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">{isPending ? "Carregando..." : "Nenhuma ocorrência encontrada"}</td></tr>}
    </tbody></table></div>
  </div>;
}
