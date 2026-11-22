import { COMPANY } from "./company";
import { fmtNum } from "./format";

export type PalletLabel = { pallet: string; controle: string; nfDevolucao: string; nfOrigem: string; fornecedor: string; cliente: string; motorista: string; recebimento: string; local: string };

/** Horizontal pallet label: big bold DEVOLUÇÃO, origin NF and supplier readable from a distance. */
export async function returnPalletPdf(h: PalletLabel, rows: string[][], format: "a4" | "a5" | "label") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", format: format === "label" ? [100, 150] : format });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const k = W / 297; // scale relative to A4 landscape
  const m = 8 * k;
  const fit = (s: string, size: number, max: number) => { let f = size; doc.setFontSize(f); while (f > 8 && doc.getTextWidth(s) > max) { f -= 1; doc.setFontSize(f); } return f; };
  doc.setLineWidth(1.2 * k); doc.rect(m, m, W - 2 * m, H - 2 * m);
  doc.setFillColor(0, 0, 0); doc.rect(m, m, W - 2 * m, 34 * k, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
  fit("DEVOLUÇÃO", 72 * k, W - 2 * m - 90 * k); doc.text("DEVOLUÇÃO", m + 5 * k, m + 26 * k);
  doc.setFontSize(30 * k); doc.text(`PALLET ${h.pallet}`, W - m - 5 * k, m + 24 * k, { align: "right" });
  doc.setTextColor(0, 0, 0);
  let y = m + 34 * k;
  const block = (label: string, value: string, size: number, height: number) => {
    doc.setLineWidth(0.6 * k); doc.line(m, y + height, W - m, y + height);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11 * k); doc.text(label, m + 5 * k, y + 7 * k);
    doc.setFont("helvetica", "bold"); fit(value || "—", size * k, W - 2 * m - 10 * k); doc.text(value || "—", m + 5 * k, y + height - 5 * k);
    y += height;
  };
  block("NF DE ORIGEM", h.nfOrigem, 56, 36 * k);
  block("FORNECEDOR", h.fornecedor.toUpperCase(), 34, 26 * k);
  block("CLIENTE", h.cliente.toUpperCase(), 22, 20 * k);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13 * k);
  doc.text(`NF devolução: ${h.nfDevolucao}   •   Controle: ${h.controle}   •   Local: ${h.local || "—"}`, m + 5 * k, y + 8 * k);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10 * k);
  doc.text(`Motorista: ${h.motorista || "—"}   •   Recebimento: ${h.recebimento || "—"}`, m + 5 * k, y + 14 * k);
  y += 20 * k;
  doc.setFontSize(10 * k);
  for (const r of rows) {
    if (y > H - m - 10 * k) break;
    const line = `${fmtNum(Number(r[2]), 3)} ${r[3]}  —  ${r[0]} ${r[1]}  |  Lote ${r[5] || "—"}  |  Val. ${r[6] || "—"}`;
    doc.text(doc.splitTextToSize(line, W - 2 * m - 10 * k)[0], m + 5 * k, y); y += 5 * k;
  }
  doc.setFontSize(8 * k); doc.text(COMPANY.apresentacao, W - m - 4 * k, H - m - 3 * k, { align: "right" });
  return doc.output("blob");
}

/** Collection term listing selected stock items for a future pickup; printing only, no stock movement. */
export async function collectionTermPdf(rows: string[][]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const cols = ["NF dev.", "NF origem", "Fornecedor", "Produto", "Lote", "Validade", "Qtd", "Un."];
  const widths = [22, 22, 50, 95, 25, 22, 22, 15];
  let y = 14;
  const header = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("TERMO DE COLETA — DEVOLUÇÕES", 10, y);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`${COMPANY.apresentacao} • Emitido em ${new Date().toLocaleString("pt-BR")}`, 10, y + 6);
    y += 12; let x = 10; doc.setFont("helvetica", "bold");
    cols.forEach((c, i) => { doc.rect(x, y, widths[i]!, 7); doc.text(c, x + 1.5, y + 5); x += widths[i]!; }); y += 7; doc.setFont("helvetica", "normal");
  };
  header();
  for (const r of rows) {
    const cells = r.map((c, i) => doc.splitTextToSize(c, widths[i]! - 3) as string[]);
    const h = Math.max(...cells.map(c => c.length)) * 4 + 3;
    if (y + h > H - 40) { doc.addPage(); y = 14; header(); }
    let x = 10; cells.forEach((c, i) => { doc.rect(x, y, widths[i]!, h); doc.text(c, x + 1.5, y + 4.5); x += widths[i]!; }); y += h;
  }
  doc.setFont("helvetica", "bold"); doc.text(`Total de itens: ${rows.length}`, 10, y + 7);
  y = Math.max(y + 25, H - 28);
  doc.setFont("helvetica", "normal");
  doc.line(15, y, 125, y); doc.text("Entregue por (Transmerida) — nome, assinatura e data", 15, y + 5);
  doc.line(W - 125, y, W - 15, y); doc.text("Retirado por — nome, documento, placa e assinatura", W - 125, y + 5);
  return doc.output("blob");
}
