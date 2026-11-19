import Decimal from "decimal.js";
export interface ReceiptVersion {
  id: string;
  carga_entrada_id: string;
  versao: number;
  tipo: string;
  dados: unknown;
}
export function receiptStates<T extends ReceiptVersion>(docs: T[], cancelled: Set<string>) {
  const latest = new Map<string, number>();
  for (const d of docs)
    if (d.tipo === "recibo")
      latest.set(d.carga_entrada_id, Math.max(latest.get(d.carga_entrada_id) || 0, d.versao));
  return docs
    .filter((d) => d.tipo === "recibo")
    .map((d) => ({
      ...d,
      situacao: cancelled.has(d.id)
        ? "cancelado"
        : d.versao === latest.get(d.carga_entrada_id)
          ? "valido"
          : "substituido",
    }));
}
export function receiptTotal(rows: { situacao: string; valor: number }[]) {
  return rows
    .filter((r) => r.situacao === "valido")
    .reduce((sum, r) => sum.plus(r.valor), new Decimal(0))
    .toNumber();
}
export function inReportPeriod(value: string, start: string, end: string) {
  if (!value || Number.isNaN(Date.parse(value))) return !start && !end;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  return (!start || day >= start) && (!end || day <= end);
}
export function validateSignedFile(file: { type: string; size: number }) {
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Selecione PDF ou imagem JPG, PNG ou WebP");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024)
    throw new Error("O arquivo deve ter até 15 MB");
}
export function receivingOccurrenceIds<
  T extends { id: string; origem: string; carga_entrada_id: string | null },
>(rows: T[], loadId: string) {
  return [
    ...new Set(
      rows
        .filter((o) => o.origem === "recebimento" && o.carga_entrada_id === loadId)
        .map((o) => o.id),
    ),
  ];
}
export function signedOccurrenceIds(
  links: { relatorio_id: string; ocorrencia_id: string }[],
  attachments: { relatorio_id: string | null }[],
) {
  const reports = new Set(attachments.map((a) => a.relatorio_id));
  return new Set(links.filter((l) => reports.has(l.relatorio_id)).map((l) => l.ocorrencia_id));
}
