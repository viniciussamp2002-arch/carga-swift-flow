import { pageHead } from "@/lib/page-head";
import { OcorrenciaBadge } from "@/components/Ocorrencias";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DepositoTabs } from "@/components/DepositoTabs";
import { Button } from "@/components/ui/button";
import { AG_STATUS_LABEL, REC_CLIENTE_LABEL } from "@/lib/agenda";
import { NOTA_STATUS_LABEL, fmtBRL, fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Send, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => pageHead("Agendamentos", "Agendamento das notas de clientes com agendamento obrigatório"),
  component: AgendamentosPage,
});

const FILTROS = ["todos", "nao_solicitado", "solicitado", "aguardando_confirmacao", "confirmado", "reagendado", "cancelado"];

function AgendamentosPage() {
  const { canWrite, user } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["agendamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agendamentos")
        .select("*, nota:nota_id(id, numero, numeros_agrupados, fornecedor, cfops, cliente, cnpj_destinatario, cidade, uf, peso, volumes, valor, data_chegada, status, recebida, entregas(resultado, data_evento))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.nota?.recebida);
    },
  });

  const filtered = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return rows.filter((r: any) => (filtro === "todos" || r.status === filtro) &&
      (!t || [r.nota.numero, r.nota.cliente, r.nota.fornecedor, r.nota.cidade, r.protocolo].some((v) => String(v ?? "").toLowerCase().includes(t))));
  }, [rows, filtro, busca]);
  const contagem = (s: string) => s === "todos" ? rows.length : rows.filter((r: any) => r.status === s).length;

  const upd = useMutation({
    mutationFn: async ({ r, campo, valor, label }: { r: any; campo: string; valor: any; label: string }) => {
      if (String(r[campo] ?? "") === String(valor ?? "")) return;
      const patch: any = { [campo]: valor === "" ? null : valor };
      if (campo === "status" && valor === "solicitado" && !r.data_solicitacao) {
        patch.data_solicitacao = new Date().toISOString(); patch.solicitante = r.solicitante || user?.email;
      }
      if (campo === "data_agendada" && r.data_agendada && valor && r.data_agendada !== valor && r.status === "confirmado") patch.status = "reagendado";
      const { error } = await supabase.from("agendamentos").update(patch).eq("id", r.id);
      if (error) throw error;
      await supabase.from("historico").insert({ entidade: "agendamento", entidade_id: r.nota.id, acao: "edicao", user_id: user?.id,
        descricao: `NF ${r.nota.numero} — ${label}: "${r[campo] ?? ""}" → "${valor ?? ""}"` });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["notas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const solicitar = (r: any) => upd.mutate({ r, campo: "status", valor: "solicitado", label: "Status" });

  const entrega = (r: any) => {
    const e = (r.nota.entregas ?? []).filter((x: any) => x.resultado === "entregue").sort((a: any, b: any) => b.data_evento.localeCompare(a.data_evento))[0];
    return e?.data_evento ?? null;
  };

  function exportar() {
    const ws = XLSX.utils.json_to_sheet(filtered.map((r: any) => ({
      "Nº NF": r.nota.numero, Fornecedor: r.nota.fornecedor, CFOP: (r.nota.cfops ?? []).join(", "), Cliente: r.nota.cliente,
      CNPJ: r.nota.cnpj_destinatario, "Cidade/UF": `${r.nota.cidade}/${r.nota.uf ?? ""}`, Peso: r.nota.peso, Volumes: r.nota.volumes,
      Valor: r.nota.valor, Recebimento: r.nota.data_chegada, Solicitação: r.data_solicitacao, Responsável: r.solicitante,
      "Data agendada": r.data_agendada, Horário: r.horario, Protocolo: r.protocolo, Status: AG_STATUS_LABEL[r.status],
      "Entrada cliente": REC_CLIENTE_LABEL[r.status_recebimento], "Data entrada": r.data_entrada,
      "Status entrega": NOTA_STATUS_LABEL[r.nota.status], "Data entrega": entrega(r), Observações: r.observacoes,
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
    XLSX.writeFile(wb, `agendamentos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const txt = (r: any, campo: string, label: string, type = "text", w = "w-32") => canWrite
    ? <input type={type} defaultValue={r[campo] ?? ""} key={r[campo] ?? ""} className={`h-8 ${w} border rounded px-1 bg-background`}
        onBlur={(e) => upd.mutate({ r, campo, valor: e.target.value, label })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
    : (r[campo] ?? "—");
  const sel = (r: any, campo: string, label: string, opts: Record<string, string>) => canWrite
    ? <select value={r[campo]} className="h-8 border rounded px-1 bg-background" onChange={(e) => upd.mutate({ r, campo, valor: e.target.value, label })}>
        {Object.entries(opts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    : opts[r[campo]];

  return (
    <div>
      <DepositoTabs />
      <PageHeader title="Agendamentos" subtitle="Notas de clientes com agendamento obrigatório — continuam no depósito até a saída"
        actions={<Button size="sm" variant="outline" className="h-9" onClick={exportar}><FileDown className="h-4 w-4 mr-1" />Exportar Excel</Button>} />
      <div className="mb-2 flex flex-wrap gap-2 items-center">
        {FILTROS.map((f) => <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} className="h-8" onClick={() => setFiltro(f)}>
          {f === "todos" ? "Todos" : AG_STATUS_LABEL[f]} ({contagem(f)})</Button>)}
        <div className="flex items-center gap-2 border rounded-md px-2 h-8 bg-card ml-auto min-w-[220px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar..." className="bg-transparent outline-none text-sm flex-1" />
        </div>
      </div>
      <div className="bg-card border rounded-md max-h-[calc(100vh-280px)] overflow-auto">
        <table className="table-erp">
          <thead><tr>
            <th>Nº NF</th><th>Fornecedor</th><th>CFOP</th><th>Cliente</th><th>CNPJ</th><th>Cidade/UF</th><th className="text-right">Peso</th>
            <th className="text-right">Vol.</th><th className="text-right">Valor</th><th>Recebimento</th><th>Solicitação</th><th>Responsável</th>
            <th>Data agendada</th><th>Horário</th><th>Protocolo</th><th>Status agend.</th><th>Entrada cliente</th><th>Data entrada</th>
            <th>Status entrega</th><th>Data entrega</th><th>Observações</th>
          </tr></thead>
          <tbody>
            {filtered.map((r: any) => { const n = r.nota; return (
              <tr key={r.id}>
                <td className="font-mono font-semibold">{n.numeros_agrupados?.length ? n.numeros_agrupados.join(" + ") : n.numero}<OcorrenciaBadge nota={n} /></td>
                <td>{n.fornecedor}</td><td title={(n.cfops ?? []).join(", ")}>{(n.cfops ?? []).join(", ") || "—"}</td>
                <td>{n.cliente}</td><td className="font-mono">{n.cnpj_destinatario}</td><td>{n.cidade}{n.uf && `/${n.uf}`}</td>
                <td className="text-right">{fmtNum(n.peso, 3)}</td><td className="text-right">{n.volumes}</td><td className="text-right">{fmtBRL(n.valor)}</td>
                <td>{fmtDate(n.data_chegada && n.data_chegada + "T12:00")}</td>
                <td>{r.data_solicitacao ? fmtDateTime(r.data_solicitacao) : canWrite
                  ? <Button size="sm" variant="outline" className="h-7" onClick={() => solicitar(r)}><Send className="h-3 w-3 mr-1" />Solicitar</Button> : "—"}</td>
                <td>{txt(r, "solicitante", "Responsável", "text", "w-40")}</td>
                <td>{txt(r, "data_agendada", "Data agendada", "date", "w-36")}</td>
                <td>{txt(r, "horario", "Horário", "time", "w-24")}</td>
                <td>{txt(r, "protocolo", "Protocolo")}</td>
                <td>{sel(r, "status", "Status", AG_STATUS_LABEL)}</td>
                <td>{sel(r, "status_recebimento", "Entrada cliente", REC_CLIENTE_LABEL)}</td>
                <td>{txt(r, "data_entrada", "Data entrada", "date", "w-36")}</td>
                <td>{NOTA_STATUS_LABEL[n.status]}</td>
                <td>{fmtDateTime(entrega(r))}</td>
                <td>{txt(r, "observacoes", "Observações", "text", "w-48")}</td>
              </tr>); })}
            {filtered.length === 0 && <tr><td colSpan={21} className="text-center text-muted-foreground py-8">
              Nenhum agendamento. Notas de clientes cadastrados em "Clientes c/ Agendamento" aparecem aqui ao serem recebidas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
