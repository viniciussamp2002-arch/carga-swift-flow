import { useMemo, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUp, ArrowDown, Filter, FileDown, Search, X, ArrowUpDown,
} from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  accessor: (row: T) => any;
  render?: (row: T) => ReactNode;
  exportValue?: (row: T) => any;
  align?: "left" | "right" | "center";
  className?: string;
  width?: string;
  filterable?: boolean;   // default true
  sortable?: boolean;     // default true
};

type Props<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  exportName?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  leftActions?: ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  data, columns, rowKey, exportName, onRowClick, rowClassName,
  leftActions, emptyMessage = "Nenhum registro encontrado",
  maxHeight = "calc(100vh - 220px)",
}: Props<T>) {
  const [sort, setSort] = useState<SortState>(null);
  // valueFilters[key] = Set of selected string values; null = all
  const [valueFilters, setValueFilters] = useState<Record<string, Set<string> | null>>({});

  const cmp = (a: any, b: any) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
  };

  const filtered = useMemo(() => {
    let rows = data;
    for (const [key, sel] of Object.entries(valueFilters)) {
      if (!sel) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      rows = rows.filter((r) => sel.has(String(col.accessor(r) ?? "")));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const r = cmp(col.accessor(a), col.accessor(b));
          return sort.dir === "asc" ? r : -r;
        });
      }
    }
    return rows;
  }, [data, columns, sort, valueFilters]);

  function handleExport() {
    const rows = filtered.map((r) => {
      const obj: Record<string, any> = {};
      for (const c of columns) {
        const v = c.exportValue ? c.exportValue(r) : c.accessor(r);
        obj[c.header] = v ?? "";
      }
      return obj;
    });
    exportToXlsx(rows, exportName || "export");
  }

  const activeFilterCount = Object.values(valueFilters).filter((v) => v && v.size > 0).length;

  return (
    <div className="bg-card border rounded-md overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span>
          <span>registro(s)</span>
          {activeFilterCount > 0 && (
            <>
              <span>•</span>
              <span>{activeFilterCount} filtro(s)</span>
              <button
                onClick={() => { setValueFilters({}); setSort(null); }}
                className="text-primary hover:underline"
              >
                Limpar todos
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {leftActions}
          {exportName && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" />Exportar Excel
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="table-pro">
          <thead>
            <tr>
              {columns.map((c) => (
                <ColumnHeader
                  key={c.key}
                  col={c}
                  data={data}
                  sort={sort}
                  setSort={setSort}
                  selected={valueFilters[c.key] ?? null}
                  setSelected={(s) => setValueFilters((prev) => ({ ...prev, [c.key]: s }))}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(onRowClick && "cursor-pointer", rowClassName?.(r))}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.render ? c.render(r) : (c.accessor(r) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnHeader<T>({
  col, data, sort, setSort, selected, setSelected,
}: {
  col: DataTableColumn<T>;
  data: T[];
  sort: SortState;
  setSort: (s: SortState) => void;
  selected: Set<string> | null;
  setSelected: (s: Set<string> | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const uniqueValues = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) set.add(String(col.accessor(r) ?? ""));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
  }, [data, col]);
  const filteredValues = q ? uniqueValues.filter((v) => v.toLowerCase().includes(q.toLowerCase())) : uniqueValues;
  const active = selected !== null && selected.size > 0;
  const isSorted = sort?.key === col.key;
  const filterable = col.filterable !== false;

  function toggleValue(v: string) {
    const next = new Set(selected ?? uniqueValues);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSelected(next.size === uniqueValues.length ? null : next);
  }

  return (
    <th
      className={cn(
        col.align === "right" && "text-right",
        col.align === "center" && "text-center",
      )}
      style={col.width ? { width: col.width } : undefined}
    >
      <div className={cn("flex items-center gap-1 group", col.align === "right" && "justify-end")}>
        <span>{col.header}</span>
        {filterable && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "opacity-40 hover:opacity-100 transition-opacity p-0.5 rounded",
                  (active || isSorted) && "opacity-100 text-primary",
                )}
              >
                {isSorted ? (
                  sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : active ? (
                  <Filter className="h-3 w-3 fill-current" />
                ) : (
                  <ArrowUpDown className="h-3 w-3" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex gap-1 mb-2">
                <Button
                  size="sm" variant={isSorted && sort!.dir === "asc" ? "default" : "outline"}
                  className="flex-1 h-7 text-xs"
                  onClick={() => setSort({ key: col.key, dir: "asc" })}
                >
                  <ArrowUp className="h-3 w-3 mr-1" />Cresc.
                </Button>
                <Button
                  size="sm" variant={isSorted && sort!.dir === "desc" ? "default" : "outline"}
                  className="flex-1 h-7 text-xs"
                  onClick={() => setSort({ key: col.key, dir: "desc" })}
                >
                  <ArrowDown className="h-3 w-3 mr-1" />Decr.
                </Button>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-7 h-7 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 py-1 border-b mb-1">
                <Checkbox
                  checked={selected === null || selected.size === uniqueValues.length}
                  onCheckedChange={(v) => setSelected(v ? null : new Set())}
                />
                <span className="text-xs font-medium">(Selecionar tudo)</span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {filteredValues.slice(0, 500).map((v) => {
                  const isSel = selected === null || selected.has(v);
                  return (
                    <label key={v} className="flex items-center gap-2 py-0.5 px-1 hover:bg-accent rounded cursor-pointer">
                      <Checkbox checked={isSel} onCheckedChange={() => toggleValue(v)} />
                      <span className="text-xs truncate" title={v}>{v || "(vazio)"}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t">
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setSelected(null); if (isSorted) setSort(null); setQ(""); }}
                >
                  <X className="h-3 w-3 mr-1" />Limpar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>OK</Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </th>
  );
}
