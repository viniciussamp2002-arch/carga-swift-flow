/** Opens a black-and-white A4 landscape report (same style as Notas Fiscais / Depósito) with a preview before printing. */
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]!);

export function tableHtml(head: string[], rows: (string | number)[][], right: number[] = []) {
  const cell = (v: string | number, i: number, tag: string) => `<${tag}${right.includes(i) ? ' class="r"' : ""}>${esc(v)}</${tag}>`;
  return `<table><thead><tr>${head.map((h, i) => cell(h, i, "th")).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => cell(v, i, "td")).join("")}</tr>`).join("")}</tbody></table>`;
}

export function openReport(title: string, meta: string[], body: string): boolean {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4 landscape;margin:10mm}*{color:#000!important;background:#fff!important}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0}h1{font-size:14px;margin:0 0 4px}h2{font-size:12px;margin:10px 0 2px}p{margin:2px 0}
    table{border-collapse:collapse;width:100%;margin-top:4px}th,td{border:1px solid #000;padding:2px 4px;text-align:left;vertical-align:top}
    th{font-weight:bold}.r{text-align:right}thead{display:table-header-group}tr{page-break-inside:avoid}.bar{margin:6px 0}
    @media print{.bar{display:none}}</style></head><body>
    <div class="bar"><button onclick="window.print()">Imprimir</button> <button onclick="window.close()">Fechar</button></div>
    <h1>Transmerida Operador Logístico — ${esc(title)}</h1><p>Emitido em: ${new Date().toLocaleString("pt-BR")}</p>
    ${meta.map((m) => `<p>${esc(m)}</p>`).join("")}${body}</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus();
  return true;
}
