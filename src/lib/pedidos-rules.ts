/** Supplier order (Pedidos Rancheiro) rules: lead time in Teresina days and Brazilian spreadsheet parsing. */
import { diffDias, hojeTeresina } from "@/lib/deadline-rules";

export const PEDIDO_STATUS_LABEL: Record<string, string> = { disponivel: "Disponível", parcial: "Parcialmente faturado", faturado: "Faturado", cancelado: "Cancelado" };

export type LeadTime = { dias: number | null; futura: boolean };
/** Lead time = today (or billing date once billed) − date shown by the supplier, in calendar days. */
export function leadTime(dataTela: string | null | undefined, hoje: string = hojeTeresina(), faturamento?: string | null): LeadTime {
  if (!dataTela) return { dias: null, futura: false };
  const ref = faturamento || hoje;
  const d = diffDias(dataTela, ref);
  return d < 0 ? { dias: null, futura: true } : { dias: d, futura: false };
}

/** "1.234,56" → 1234.56; "1234.5" → 1234.5; numbers pass through. Returns null when not a number. */
export function parseBrNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/[R$\s]/g, "").replace(/m³|kg/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd, Date or Excel serial → ISO date. */
export function parseBrDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (m) { const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const PEDIDO_FIELDS = [
  { key: "numero_pedido", label: "Número do pedido", hints: ["pedido", "numeropedido", "nped", "ped", "ordem"] },
  { key: "cliente", label: "Cliente", hints: ["cliente", "nomecliente", "razaosocial", "destinatario"] },
  { key: "cnpj", label: "CNPJ", hints: ["cnpj", "cnpjcliente", "cpfcnpj"] },
  { key: "rota", label: "Rota", hints: ["rota"] },
  { key: "cidade", label: "Cidade", hints: ["cidade", "municipio", "destino"] },
  { key: "data_tela", label: "Data na tela", hints: ["datanatela", "datatela", "data", "dataliberacao", "disponibilizado"] },
  { key: "data_faturamento", label: "Data de faturamento", hints: ["datafaturamento", "faturamento", "dtfat"] },
  { key: "peso", label: "Peso", hints: ["peso", "pesokg", "pesobruto"] },
  { key: "valor", label: "Valor do pedido", hints: ["valor", "valorpedido", "valortotal", "total"] },
  { key: "m3", label: "M³", hints: ["m3", "cubagem", "volume", "metroscubicos"] },
  { key: "status_fornecedor", label: "Status (fornecedor)", hints: ["status", "situacao"] },
] as const;
export type PedidoFieldKey = (typeof PEDIDO_FIELDS)[number]["key"];

const normHeader = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
/** Suggests which spreadsheet column feeds each field, regardless of column order. */
export function guessMapping(headers: string[]): Partial<Record<PedidoFieldKey, number>> {
  const out: Partial<Record<PedidoFieldKey, number>> = {}; const used = new Set<number>();
  for (const f of PEDIDO_FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && (f.hints as readonly string[]).includes(normHeader(h)));
    if (idx >= 0) { out[f.key] = idx; used.add(idx); }
  }
  return out;
}

export type PedidoRow = { numero_pedido: string; cliente: string; cnpj: string; rota: string; cidade: string; data_tela: string | null; data_faturamento: string | null; peso: number; valor: number; m3: number; status_fornecedor: string };
/** Converts one raw row using the mapping; keeps leading zeros and reports every problem instead of dropping the row. */
export function buildPedido(raw: unknown[], map: Partial<Record<PedidoFieldKey, number>>): { row: PedidoRow; erros: string[] } {
  const cell = (k: PedidoFieldKey) => (map[k] === undefined ? "" : raw[map[k]!]);
  const text = (k: PedidoFieldKey) => String(cell(k) ?? "").trim();
  const erros: string[] = [];
  const num = (k: PedidoFieldKey, label: string) => { const c = cell(k); if (c === "" || c == null) return 0; const n = parseBrNumber(c); if (n === null) { erros.push(`${label} inválido`); return 0; } return n; };
  const date = (k: PedidoFieldKey, label: string) => { const c = cell(k); if (c === "" || c == null) return null; const d = parseBrDate(c); if (!d) erros.push(`${label} inválida`); return d; };
  const row: PedidoRow = {
    numero_pedido: text("numero_pedido"), cliente: text("cliente"), cnpj: text("cnpj"), rota: text("rota"), cidade: text("cidade"),
    data_tela: date("data_tela", "Data na tela"), data_faturamento: date("data_faturamento", "Data de faturamento"),
    peso: num("peso", "Peso"), valor: num("valor", "Valor"), m3: num("m3", "M³"), status_fornecedor: text("status_fornecedor"),
  };
  if (!row.numero_pedido) erros.push("Sem número do pedido");
  return { row, erros };
}

/** Splits pasted spreadsheet text (tab separated) or CSV (; or ,) into rows. */
export function splitPasted(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const first = lines[0] ?? "";
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}
