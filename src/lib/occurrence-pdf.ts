import type { OccurrenceSnapshot } from "./receiving-reports";
import { OC_TIPO_LABEL } from "./occurrence-rules";
import { COMPANY } from "./company";
import { fmtDateTime, fmtNum } from "./format";
export async function tabularPdf(
  title: string,
  headers: string[],
  rows: string[][],
  summary: string,
  landscape = true,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4", orientation: landscape ? "landscape" : "portrait" });
  const width = doc.internal.pageSize.getWidth() - 24;
  let y = 16;
  function heading() {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 12, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(summary, width);
    doc.text(lines, 12, y);
    y += lines.length * 4 + 5;
  }
  heading();
  const column = width / headers.length;
  function row(values: string[], bold = false) {
    const wrapped = values.map((v) => doc.splitTextToSize(v || "—", column - 4));
    let offsets = values.map(() => 0);
    let remaining = Math.max(...wrapped.map((v) => v.length), 1);
    while (remaining > 0) {
      const available = Math.floor((doc.internal.pageSize.getHeight() - 18 - y - 4) / 4);
      if (available < 1) {
        doc.addPage();
        y = 16;
        header();
        continue;
      }
      const count = Math.min(remaining, available);
      const h = count * 4 + 4;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8);
      wrapped.forEach((lines, i) => {
        doc.rect(12 + i * column, y, column, h);
        doc.text(lines.slice(offsets[i], offsets[i] + count), 14 + i * column, y + 5);
        offsets[i] += count;
      });
      y += h;
      remaining -= count;
    }
  }
  function header() {
    row(headers, true);
  }
  header();
  for (const r of rows) row(r);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.text(
      `${COMPANY.apresentacao} · Página ${p}/${pages}`,
      12,
      doc.internal.pageSize.getHeight() - 8,
    );
  }
  return doc.output("blob");
}
export async function occurrencePdf(data: OccurrenceSnapshot, responsible: string, issued: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: "a4" });
  let y = 18;
  const text = (value: string, bold = false, size = 10) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    for (const l of doc.splitTextToSize(value || "________________", 174)) {
      if (y > 267) {
        doc.addPage();
        y = 18;
      }
      doc.text(l, 18, y);
      y += 5;
    }
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OCORRÊNCIA NO RECEBIMENTO", 105, y, { align: "center" });
  y += 10;
  text(`${COMPANY.nome} | CNPJ ${COMPANY.cnpj}`, false, 9);
  text(`Transporte: ${data.transporte} | Transportadora: ${data.transportadora}`);
  text(`Fornecedor(es): ${[...new Set(data.ocorrencias.map((o) => o.fornecedor))].join("; ")}`);
  text(`Recebimento: ${data.data ? fmtDateTime(data.data) : "________________"}`);
  text(
    `Motorista: ${data.motorista || "________________"} | CPF: ${data.cpf || "________________"}`,
  );
  text(`Placa: ${data.placa || "________________"}`);
  y += 4;
  const widths = [24, 70, 19, 35, 26];
  const labels = ["CÓDIGO", "DESCRIÇÃO DO PRODUTO", "QTD", "MOTIVO", "NOTA FISCAL"];
  function tableRow(vals: string[], bold = false) {
    doc.setFontSize(8);
    const lines = vals.map((v, i) => doc.splitTextToSize(v || "—", widths[i] - 4));
    let remaining = Math.max(...lines.map((l) => l.length), 1),
      offset = 0;
    while (remaining > 0) {
      let available = Math.floor((266 - y - 5) / 4);
      if (available < 1) {
        doc.addPage();
        y = 18;
        tableRow(labels, true);
        available = Math.floor((266 - y - 5) / 4);
      }
      const count = Math.min(remaining, available),
        h = count * 4 + 5;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8);
      let x = 18;
      lines.forEach((l, i) => {
        doc.rect(x, y, widths[i], h);
        const part = l.slice(offset, offset + count);
        if (part.length) doc.text(part, x + 2, y + 5);
        x += widths[i];
      });
      y += h;
      remaining -= count;
      offset += count;
    }
  }
  tableRow(labels, true);
  for (const o of data.ocorrencias)
    tableRow([
      o.produto_codigo || "—",
      o.produto_descricao || "Não vinculada a item",
      o.quantidade == null ? "—" : `${fmtNum(o.quantidade, 3)} ${o.unidade || ""}`,
      OC_TIPO_LABEL[o.tipo] || o.tipo,
      o.numero_nf,
    ]);
  y += 8;
  text("OBSERVAÇÕES", true);
  for (const o of data.ocorrencias) text(`NF ${o.numero_nf} — ${o.descricao}`);
  y += 6;
  text(
    "O motorista declara ciência das ocorrências relacionadas neste documento. Este termo não confirma devolução de mercadorias nem altera a situação operacional das ocorrências.",
  );
  if (y > 218) {
    doc.addPage();
    y = 30;
  }
  y += 20;
  text("____________________________________________________");
  text(`CONFERENTE: ${data.conferente || ""}`);
  y += 16;
  text("____________________________________________________");
  text(`MOTORISTA: ${data.motorista || ""}`);
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.text(
      `Emitido por ${responsible || "—"} em ${fmtDateTime(issued)} · ${p}/${doc.getNumberOfPages()}`,
      18,
      287,
    );
  }
  return doc.output("blob");
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
