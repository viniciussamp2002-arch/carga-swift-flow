import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOcorrencias } from "./Ocorrencias";
import { InboundOccurrenceItems } from "./InboundOccurrenceItems";
import { SignedReceivingDocuments, PdfViewer } from "./ReceivingSignedDocuments";
import { occurrencePdf } from "@/lib/occurrence-pdf";
import { receivingOccurrenceIds } from "@/lib/receiving-report-rules";
import type { OccurrenceSnapshot, OccurrenceReport } from "@/lib/receiving-reports";
import type { ReceivingLoad, ReceivingNote } from "@/lib/receiving-rules";
import type { Json } from "@/integrations/supabase/types";
import { fmtDateTime } from "@/lib/format";
import { OC_TIPO_LABEL } from "@/lib/occurrence-rules";
import { Printer, Eye } from "lucide-react";
import { toast } from "sonner";
export function ReceivingOccurrenceDocuments({
  load,
  notes,
  readOnly = false,
}: {
  load: ReceivingLoad & { veiculo_id?: string | null };
  notes: ReceivingNote[];
  readOnly?: boolean;
}) {
  const map = useOcorrencias();
  const { canReceive } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [supplement, setSupplement] = useState<Record<string, string>>({});
  const all = notes.flatMap((n) => map.get(n.id) || []);
  const ids = receivingOccurrenceIds(all, load.id);
  const rows = all.filter((o) => ids.includes(o.id));
  const reports = useQuery({
    queryKey: ["occurrence-reports", load.id],
    queryFn: async () => {
      const r = await supabase
        .from("relatorios_ocorrencias_recebimento")
        .select("*")
        .eq("carga_entrada_id", load.id)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const driver = useQuery({
    queryKey: ["receiving-driver-cpf", load.veiculo_id],
    queryFn: async () => {
      if (!load.veiculo_id) return null;
      const r = await supabase
        .from("veiculos")
        .select("motoristas(nome,cpf)")
        .eq("id", load.veiculo_id)
        .maybeSingle();
      if (r.error) throw r.error;
      const motorist = r.data?.motoristas;
      if (!motorist) return null;
      return motorist.nome.trim().toLowerCase() === load.motorista?.trim().toLowerCase()
        ? motorist.cpf
        : null;
    },
  });
  const missing = [
    !load.motorista && "motorista",
    !load.placa && "placa",
    !driver.data && "cpf",
    !load.data_chegada && "data",
    !load.recebido_por_nome && "conferente",
  ].filter((k): k is string => typeof k === "string");
  async function display(report: OccurrenceReport) {
    const blob = await occurrencePdf(
      report.dados as unknown as OccurrenceSnapshot,
      report.registrado_por_nome || "",
      report.created_at,
    );
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({
      url: URL.createObjectURL(blob),
      name: `ocorrencia-${load.numero_transporte}-${report.id.slice(0, 8)}.pdf`,
    });
  }
  async function emit(selected: string[]) {
    setBusy(true);
    try {
      const r = await supabase
        .from("relatorios_ocorrencias_recebimento")
        .insert({
          carga_entrada_id: load.id,
          dados: { ocorrencia_ids: selected, complementos: supplement } as Json,
        })
        .select()
        .single();
      if (r.error) throw r.error;
      qc.invalidateQueries({ queryKey: ["occurrence-reports", load.id] });
      qc.invalidateQueries({ queryKey: ["receiving-reports"] });
      qc.invalidateQueries({ queryKey: ["receiving-history", load.id] });
      await display(r.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao emitir ocorrência");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <InboundOccurrenceItems
        notes={notes}
        transporte={load.numero_transporte}
        readOnly={readOnly}
      />
      <section className="space-y-3 border-t pt-3">
        <h3 className="font-semibold">Documentos de ocorrências</h3>
        {canReceive && !readOnly && rows.length > 0 && (
          <>
            <div className="grid sm:grid-cols-3 gap-2">
              {missing.map((key) => (
                <label className="text-xs" key={key}>
                  {
                    (
                      {
                        motorista: "Motorista",
                        placa: "Placa",
                        cpf: "CPF do motorista",
                        data: "Data do recebimento",
                        conferente: "Conferente",
                      } as Record<string, string>
                    )[key]
                  }
                  <Input
                    aria-label={`Complementar ${key}`}
                    type={key === "data" ? "datetime-local" : "text"}
                    value={supplement[key] || ""}
                    onChange={(e) => setSupplement({ ...supplement, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || driver.isPending}
              onClick={() => emit(ids)}
            >
              <Printer className="h-4 w-4" />
              Imprimir Ocorrências Consolidadas
            </Button>
            <div className="overflow-auto">
              <table className="table-erp">
                <thead>
                  <tr>
                    <th>NF</th>
                    <th>Produto</th>
                    <th>Motivo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>{notes.find((n) => n.id === o.nota_id)?.numero}</td>
                      <td>{o.produto_descricao || "—"}</td>
                      <td>{OC_TIPO_LABEL[o.tipo]}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || driver.isPending}
                          onClick={() => emit([o.id])}
                        >
                          <Printer className="h-4 w-4" />
                          Imprimir Ocorrência
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!rows.length && (
          <p className="text-muted-foreground text-sm">
            Nenhuma ocorrência de recebimento nesta carga.
          </p>
        )}
        {reports.error && (
          <p role="alert" className="text-destructive">
            Não foi possível consultar documentos.
          </p>
        )}
        {(reports.data || []).map((report) => (
          <section key={report.id} className="border-y py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs flex-1">
                {(report.dados as unknown as OccurrenceSnapshot).ocorrencia_ids.length}{" "}
                ocorrência(s) · {fmtDateTime(report.created_at)} · {report.registrado_por_nome}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void display(report).catch(() => toast.error("Não foi possível abrir o PDF"));
                }}
              >
                <Eye className="h-4 w-4" />
                Visualizar / Imprimir
              </Button>
            </div>
            <SignedReceivingDocuments
              loadId={load.id}
              reportId={report.id}
              label="Ocorrência"
              readOnly={readOnly}
            />
          </section>
        ))}
      </section>
      {preview && (
        <PdfViewer
          preview={preview}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}
