import { COMPANY } from "./company";
import { fmtNum } from "./format";
export async function returnPalletPdf(header: string[], rows: string[][], format: "a4" | "a5" | "label") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ format: format === "label" ? [100, 150] : format });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  let y = 12;
  const text = (s: string, bold = false, size = 9) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(s, width - 20);
    for (const line of lines) { if (y > height - 12) { doc.addPage(); y = 12; } doc.text(line, 10, y); y += 4.5; }
  };
  text(COMPANY.apresentacao, true, 13);
  header.forEach(h => text(h));
  y += 4;
  rows.forEach(r => { text(`${r[0]} — ${r[1]}`, true); text(`${fmtNum(Number(r[2]), 3)} ${r[3]} — ${r[4]}`); text(`Lote: ${r[5] || "Não informado"} | Validade: ${r[6] || "Não informada"}`); if (r[7]) text(`Observações: ${r[7]}`); y += 3; });
  return doc.output("blob");
}