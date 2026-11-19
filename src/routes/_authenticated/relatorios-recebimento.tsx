import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { receivingReportsOptions, type OccurrenceSnapshot } from "@/lib/receiving-reports";
import {
  receiptStates,
  receiptTotal,
  inReportPeriod,
  signedOccurrenceIds,
} from "@/lib/receiving-report-rules";
import { receivingPdf } from "@/lib/receiving-pdf";
import { occurrencePdf, tabularPdf, downloadBlob } from "@/lib/occurrence-pdf";
import type { ReceivingData } from "@/lib/receiving-rules";
import { OC_TIPO_LABEL, OC_STATUS_LABEL } from "@/lib/occurrence-rules";
import { fmtBRL, fmtNum, fmtDateTime } from "@/lib/format";
import { pageHead } from "@/lib/page-head";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PdfViewer, SignedReceivingDocuments } from "@/components/ReceivingSignedDocuments";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Download, FileSpreadsheet, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
export const Route = createFileRoute("/_authenticated/relatorios-recebimento")({
  head: () =>
    pageHead(
      "Relatórios de Recebimento",
      "Recibos de descarga, documentos assinados e ocorrências por período.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(receivingReportsOptions),
  component: ReceivingReportsPage,
});
const STATUS: Record<string, string> = {
  valido: "Válido",
  cancelado: "Cancelado",
  substituido: "Substituído",
};
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function ReceivingReportsPage() {
  const { data } = useSuspenseQuery(receivingReportsOptions);
  const qc = useQueryClient();
  const { isAdmin, canReceive } = useAuth();
  const [tab, setTab] = useState("recibos");
  const [month, setMonth] = useState("todos");
  const [year, setYear] = useState("todos");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [carrier, setCarrier] = useState("");
  const [driver, setDriver] = useState("");
  const [transport, setTransport] = useState("");
  const [supplier, setSupplier] = useState("");
  const [nf, setNf] = useState("");
  const [type, setType] = useState("todos");
  const [state, setState] = useState("todos");
  const [signed, setSigned] = useState("todos");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [detail, setDetail] = useState<{
    loadId: string;
    receiptId?: string;
    reportId?: string;
    label: "Recibo" | "Ocorrência";
  } | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const loads = new Map(data.loads.map((l) => [l.id, l]));
  const notes = new Map(data.notes.map((n) => [n.id, n]));
  const signedIds = signedOccurrenceIds(data.links, data.attachments);
  const cancelled = new Set(data.cancellations.map((c) => c.recibo_id));
  const period = (date: string) => {
    if (!inReportPeriod(date, start, end)) return false;
    const day = date
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Fortaleza",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(date))
      : "";
    return (
      (month === "todos" || day.slice(5, 7) === month) &&
      (year === "todos" || day.slice(0, 4) === year)
    );
  };
  const includes = (value: string | null | undefined, query: string) =>
    (value || "").toLowerCase().includes(query.trim().toLowerCase());
  const receipts = receiptStates(data.docs, cancelled).map((d) => {
    const snapshot = d.dados as unknown as ReceivingData;
    const load = loads.get(d.carga_entrada_id);
    return {
      ...d,
      snapshot,
      load,
      valor: Number(snapshot.valor_total || 0),
      hasSigned: data.attachments.some((a) => a.recibo_id === d.id),
      mode:
        snapshot.cobrancas && snapshot.cobrancas.length > 1
          ? "Mista"
          : (
              { peso: "Por peso", volume: "Por volume", pallet: "Por pallet" } as Record<
                string,
                string
              >
            )[snapshot.cobrancas?.[0]?.modalidade || "peso"],
    };
  });
  const filteredReceipts = receipts.filter(
    (r) =>
      period(r.snapshot.data || r.created_at) &&
      includes(r.snapshot.transportadora, carrier) &&
      includes(r.snapshot.motorista, driver) &&
      includes(r.snapshot.transporte, transport) &&
      (state === "todos" || r.situacao === state) &&
      (signed === "todos" || r.hasSigned === (signed === "assinado")),
  );
  const occurrences = data.occurrences
    .map((o) => ({
      ...o,
      note: notes.get(o.nota_id),
      load: loads.get(o.carga_entrada_id || ""),
      hasSigned: signedIds.has(o.id),
    }))
    .filter(
      (o) =>
        period(o.data_ocorrencia) &&
        includes(o.load?.transportadora, carrier) &&
        includes(o.load?.numero_transporte, transport) &&
        includes(o.note?.fornecedor, supplier) &&
        includes(o.note?.numero, nf) &&
        (type === "todos" || o.tipo === type) &&
        (state === "todos" || o.status === state) &&
        (signed === "todos" || o.hasSigned === (signed === "assinado")),
    );
  const valid = filteredReceipts.filter((r) => r.situacao === "valido");
  const total = receiptTotal(filteredReceipts);
  const rows =
    tab === "recibos"
      ? filteredReceipts.map((r) => [
          fmtDateTime(r.snapshot.data || r.created_at),
          r.snapshot.transporte,
          r.snapshot.transportadora,
          r.snapshot.motorista,
          String(r.snapshot.notas.length),
          r.mode,
          fmtBRL(r.valor),
          STATUS[r.situacao],
          r.hasSigned ? "Assinado" : "Aguardando assinatura",
        ])
      : occurrences.map((o) => [
          fmtDateTime(o.data_ocorrencia),
          o.load?.numero_transporte || "—",
          o.note?.numero || "—",
          o.note?.fornecedor || "—",
          o.produto_codigo || "—",
          o.produto_descricao || "—",
          o.quantidade == null ? "—" : `${fmtNum(o.quantidade, 3)} ${o.unidade || ""}`,
          OC_TIPO_LABEL[o.tipo],
          o.registrado_por_nome || "—",
          OC_STATUS_LABEL[o.status],
          o.hasSigned ? "Assinado" : "Aguardando assinatura",
        ]);
  const headers =
    tab === "recibos"
      ? [
          "Recebimento",
          "Transporte",
          "Transportadora",
          "Motorista",
          "NFs",
          "Modalidade",
          "Valor descarga",
          "Recibo",
          "Assinatura",
        ]
      : [
          "Data",
          "Carga",
          "NF",
          "Fornecedor",
          "Código",
          "Produto",
          "Qtd afetada",
          "Motivo",
          "Responsável",
          "Situação",
          "Assinatura",
        ];
  const title = tab === "recibos" ? "Recibos de Descarga" : "Ocorrências de Recebimento";
  const summary = `Período: ${start || "início"} a ${end || "fim"} | Mês: ${month} | Ano: ${year} | Transportadora: ${carrier || "todas"} | Transporte: ${transport || "todos"} | ${tab === "recibos" ? `Motorista: ${driver || "todos"} | Total válido: ${fmtBRL(total)}` : `Fornecedor: ${supplier || "todos"} | NF: ${nf || "todas"}`} | Situação: ${state} | Assinatura: ${signed} | ${rows.length} registro(s)`;
  const years = [
    ...new Set(
      [
        ...data.docs.map((d) => (d.dados as unknown as ReceivingData).data || d.created_at),
        ...data.occurrences.map((o) => o.data_ocorrencia),
      ]
        .filter(Boolean)
        .map((d) => d.slice(0, 4)),
    ),
  ]
    .sort()
    .reverse();
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir");
    } finally {
      setBusy(false);
    }
  }
  async function show(blob: Blob, name: string) {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(blob), name });
  }
  async function occurrenceDocument(id: string, download = false) {
    let report = data.reports
      .filter((r) => (r.dados as unknown as OccurrenceSnapshot).ocorrencia_ids.includes(id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!report) {
      if (!canReceive) throw new Error("Documento ainda não emitido");
      const o = data.occurrences.find((o) => o.id === id);
      if (!o?.carga_entrada_id) throw new Error("Carga não vinculada");
      const r = await supabase
        .from("relatorios_ocorrencias_recebimento")
        .insert({ carga_entrada_id: o.carga_entrada_id, dados: { ocorrencia_ids: [id] } })
        .select()
        .single();
      if (r.error) throw r.error;
      report = r.data;
      qc.invalidateQueries({ queryKey: ["receiving-reports"] });
    }
    const blob = await occurrencePdf(
      report.dados as unknown as OccurrenceSnapshot,
      report.registrado_por_nome || "",
      report.created_at,
    );
    if (download) downloadBlob(blob, "ocorrencia-recebimento.pdf");
    else {
      setDetail({ loadId: report.carga_entrada_id, reportId: report.id, label: "Ocorrência" });
      await show(blob, "Ocorrência no Recebimento");
    }
  }
  const analyses = useMemo(() => {
    const counts = (values: string[]) =>
      Object.entries(
        values.reduce<Record<string, number>>((m, s) => ({ ...m, [s]: (m[s] || 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]);
    return {
      suppliers: counts(occurrences.map((o) => o.note?.fornecedor || "Não informado")),
      types: counts(occurrences.map((o) => OC_TIPO_LABEL[o.tipo])),
      months: counts(occurrences.map((o) => o.data_ocorrencia.slice(0, 7))),
    };
  }, [occurrences]);
  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios de Recebimento" />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setState("todos");
        }}
      >
        <TabsList>
          <TabsTrigger value="recibos">Recibos de Descarga</TabsTrigger>
          <TabsTrigger value="ocorrencias">Ocorrências de Recebimento</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <Filter
          label="Todos os meses"
          value={month}
          onChange={setMonth}
          options={Array.from({ length: 12 }, (_, i) => ({
            value: String(i + 1).padStart(2, "0"),
            label: new Date(2026, i, 1).toLocaleDateString("pt-BR", { month: "long" }),
          }))}
        />
        <Filter
          label="Todos os anos"
          value={year}
          onChange={setYear}
          options={years.map((y) => ({ value: y, label: y }))}
        />
        <label className="text-xs">
          De
          <Input
            aria-label="Período inicial"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="text-xs">
          Até
          <Input
            aria-label="Período final"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Input
          aria-label="Filtrar transportadora"
          placeholder="Transportadora"
          className="w-48"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />
        <Input
          aria-label="Filtrar transporte"
          placeholder="Número do transporte"
          className="w-48"
          value={transport}
          onChange={(e) => setTransport(e.target.value)}
        />
        {tab === "recibos" ? (
          <Input
            aria-label="Filtrar motorista"
            placeholder="Motorista"
            className="w-48"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          />
        ) : (
          <>
            <Input
              aria-label="Filtrar fornecedor"
              placeholder="Fornecedor"
              className="w-48"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <Input
              aria-label="Filtrar NF"
              placeholder="Número da NF"
              className="w-48"
              value={nf}
              onChange={(e) => setNf(e.target.value)}
            />
            <Filter
              label="Todos os tipos"
              value={type}
              onChange={setType}
              options={Object.entries(OC_TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </>
        )}
        <Filter
          label="Todas as situações"
          value={state}
          onChange={setState}
          options={Object.entries(tab === "recibos" ? STATUS : OC_STATUS_LABEL).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <Filter
          label="Todas as assinaturas"
          value={signed}
          onChange={setSigned}
          options={[
            { value: "assinado", label: "Documento assinado anexado" },
            { value: "pendente", label: "Aguardando assinatura" },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y py-4 text-sm">
        {(tab === "recibos"
          ? [
              ["Recibos emitidos", valid.length],
              ["Valor total das descargas", fmtBRL(total)],
              ["Com assinatura", valid.filter((r) => r.hasSigned).length],
              ["Aguardando assinatura", valid.filter((r) => !r.hasSigned).length],
            ]
          : [
              ["Ocorrências registradas", occurrences.length],
              ["Com assinatura", occurrences.filter((o) => o.hasSigned).length],
              ["Aguardando assinatura", occurrences.filter((o) => !o.hasSigned).length],
              ["Abertas", occurrences.filter((o) => o.status !== "resolvida").length],
              ["Resolvidas", occurrences.filter((o) => o.status === "resolvida").length],
            ]
        ).map(([label, value]) => (
          <div key={label}>
            <span className="text-muted-foreground">{label}</span>
            <strong className="block text-xl">{value}</strong>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () =>
              downloadBlob(
                await tabularPdf(title, headers, rows, summary),
                `${tab}-recebimento.pdf`,
              ),
            )
          }
        >
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const XLSX = await import("xlsx");
              const sheet = XLSX.utils.aoa_to_sheet([
                [title],
                [summary],
                headers,
                ...rows,
                ...(tab === "recibos" ? [["Total válido", total]] : []),
              ]);
              const book = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(book, sheet, "Recebimento");
              XLSX.writeFile(book, `${tab}-recebimento.xlsx`);
            })
          }
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>
      <div className="overflow-auto border">
        <table className="table-erp">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const receipt = filteredReceipts[i];
              const occurrence = occurrences[i];
              const loadId =
                tab === "recibos" ? receipt.carga_entrada_id : occurrence.carga_entrada_id;
              return (
                <tr key={tab === "recibos" ? receipt.id : occurrence.id}>
                  {row.map((cell, j) => (
                    <td className={j === 5 ? "max-w-64 whitespace-normal" : ""} key={j}>
                      {cell}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Consultar documento"
                        title="Consultar documento"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            if (tab === "recibos") {
                              setDetail({
                                loadId: receipt.carga_entrada_id,
                                receiptId: receipt.id,
                                label: "Recibo",
                              });
                              await show(
                                await receivingPdf(
                                  receipt.snapshot,
                                  "recibo",
                                  receipt.versao,
                                  receipt.registrado_por_nome || "",
                                  receipt.created_at,
                                ),
                                `Recibo ${receipt.snapshot.transporte} v${receipt.versao}`,
                              );
                            } else await occurrenceDocument(occurrence.id);
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Baixar documento original"
                        title="Baixar documento original"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            if (tab === "recibos")
                              downloadBlob(
                                await receivingPdf(
                                  receipt.snapshot,
                                  "recibo",
                                  receipt.versao,
                                  receipt.registrado_por_nome || "",
                                  receipt.created_at,
                                ),
                                `recibo-v${receipt.versao}.pdf`,
                              );
                            else await occurrenceDocument(occurrence.id, true);
                          })
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {loadId && (
                        <Button variant="ghost" size="icon" asChild title="Abrir carga">
                          <Link
                            to="/cargas-previstas"
                            search={{ carga: loadId }}
                            aria-label="Abrir carga"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {tab === "ocorrencias" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/notas" search={{ q: occurrence.note?.numero || "" }}>
                            NF
                          </Link>
                        </Button>
                      )}
                      {isAdmin && tab === "recibos" && receipt.situacao === "valido" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Cancelar recibo"
                          title="Cancelar recibo"
                          onClick={() => {
                            setCancel(receipt.id);
                            setReason("");
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={headers.length + 1} className="text-center py-6">
                  Nenhum registro no período filtrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {tab === "ocorrencias" && (
        <section className="border-t pt-4">
          <h2 className="font-semibold mb-3">Análise do período</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ["Fornecedores", analyses.suppliers],
              ["Tipos de ocorrência", analyses.types],
              ["Ocorrências por mês", analyses.months],
            ].map(([label, items]) => (
              <div key={String(label)}>
                <h3 className="text-sm font-semibold">{String(label)}</h3>
                {(items as [string, number][]).map(([name, count]) => (
                  <div key={name} className="flex justify-between gap-3 border-b py-1 text-sm">
                    <span>{name}</span>
                    <b>{count}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      {detail && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{detail.label} — documentos e versões</DialogTitle>
            </DialogHeader>
            {detail.receiptId && (
              <>
                <p>
                  Transporte {loads.get(detail.loadId)?.numero_transporte} · Versão{" "}
                  {receipts.find((r) => r.id === detail.receiptId)?.versao}
                </p>
                <p>Valor: {fmtBRL(receipts.find((r) => r.id === detail.receiptId)?.valor || 0)}</p>
                <p>
                  Situação:{" "}
                  {STATUS[receipts.find((r) => r.id === detail.receiptId)?.situacao || ""]}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    run(async () => {
                      const r = receipts.find((r) => r.id === detail.receiptId);
                      if (r)
                        await show(
                          await receivingPdf(
                            r.snapshot,
                            "recibo",
                            r.versao,
                            r.registrado_por_nome || "",
                            r.created_at,
                          ),
                          "Recibo de Descarga",
                        );
                    })
                  }
                >
                  Visualizar PDF emitido
                </Button>
                <p className="text-sm">
                  Versões do recibo:{" "}
                  {receipts
                    .filter((r) => r.carga_entrada_id === detail.loadId)
                    .map((r) => `v${r.versao} (${STATUS[r.situacao]})`)
                    .join(" · ")}
                </p>
              </>
            )}
            <SignedReceivingDocuments {...detail} />
          </DialogContent>
        </Dialog>
      )}
      {preview && (
        <PdfViewer
          preview={preview}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
      {cancel && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setCancel(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar recibo</DialogTitle>
            </DialogHeader>
            <Input
              aria-label="Justificativa do cancelamento"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Justificativa"
            />
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                run(async () => {
                  const r = await supabase
                    .from("recibo_recebimento_eventos")
                    .insert({ recibo_id: cancel, motivo: reason });
                  if (r.error) throw r.error;
                  await qc.invalidateQueries({ queryKey: ["receiving-reports"] });
                  setCancel(null);
                  toast.success("Recibo cancelado; histórico preservado");
                })
              }
            >
              Confirmar cancelamento
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
