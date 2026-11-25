/** Shared column-header filter logic: multi-value selections combined across columns over all rows (not only the visible page). */
export type ColFilters = Record<string, string[]>;
export type ColSort = { key: string; dir: "asc" | "desc" } | null;
export type Getters<T> = Record<string, (r: T) => string>;

export const EMPTY_VALUE = "(vazio)";
const norm = (v: string) => (v ?? "").trim() || EMPTY_VALUE;

export function distinctValues<T>(rows: T[], get: (r: T) => string): string[] {
  return [...new Set(rows.map((r) => norm(get(r))))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

export function applyColumnFilters<T>(rows: T[], filters: ColFilters, get: Getters<T>): T[] {
  const active = Object.entries(filters).filter(([k, v]) => v.length && get[k]);
  if (!active.length) return rows;
  return rows.filter((r) => active.every(([k, vals]) => vals.includes(norm(get[k]!(r)))));
}

export function sortRows<T>(rows: T[], sort: ColSort, get: Getters<T>, numeric: Record<string, (r: T) => number> = {}): T[] {
  if (!sort) return rows;
  const g = get[sort.key]; const n = numeric[sort.key];
  if (!g && !n) return rows;
  const m = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => m * (n ? n(a) - n(b) : g!(a).localeCompare(g!(b), "pt-BR", { numeric: true })));
}

export const hasActiveFilters = (f: ColFilters) => Object.values(f).some((v) => v.length > 0);
