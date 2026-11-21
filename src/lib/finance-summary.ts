import Decimal from "decimal.js";
export function financeSummary(rows: { id: string; grupo: string; valor: number | null; previsao: boolean }[]) {
  const seen = new Set<string>();
  const groups = new Map<string, { grupo: string; notas: number; previsto: Decimal; aprovado: Decimal }>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const group = groups.get(row.grupo) ?? { grupo: row.grupo, notas: 0, previsto: new Decimal(0), aprovado: new Decimal(0) };
    group.notas++;
    if (row.valor !== null) { if (row.previsao) group.previsto = group.previsto.plus(row.valor); else group.aprovado = group.aprovado.plus(row.valor); }
    groups.set(row.grupo, group);
  }
  return [...groups.values()].map(g => ({ ...g, previsto: g.previsto.toNumber(), aprovado: g.aprovado.toNumber() }));
}