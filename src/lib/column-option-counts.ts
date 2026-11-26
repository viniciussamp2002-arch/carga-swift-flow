/** Contagem de opções de filtro de coluna: quantas linhas cada opção devolve, considerando apenas os demais filtros já ativos. */

/** Linhas que passam por todos os filtros, exceto o da coluna que está sendo contada. */
export function rowsPassingOtherFilters<T>(
  rows: T[],
  filters: Record<string, string>,
  skipKey: string,
  test: (row: T, key: string, value: string) => boolean,
): T[] {
  return rows.filter((r) => Object.entries(filters).every(([k, v]) => !v || k === skipKey || test(r, k, v)));
}

/** Quantidade de linhas por valor distinto de uma coluna; valores vazios não entram na lista. */
export function valueCounts<T>(rows: T[], get: (r: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = String(get(r) ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}
