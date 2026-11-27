import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColFilters, ColSort, FilterOption } from "@/lib/column-filters";

type Opts = () => { total: number; options: FilterOption[] };

/** Column header with Excel-like filter: cascaded value list with counts, search, multi-select, select all, clear, apply and sort. */
export function FilterTh({ label, colKey, options, filters, setFilters, sort, setSort, className = "" }: {
  label: React.ReactNode; colKey: string; options: Opts; filters: ColFilters; setFilters: (f: ColFilters) => void;
  sort: ColSort; setSort: (s: ColSort) => void; className?: string;
}) {
  const sorted = sort?.key === colKey;
  return (
    <th className={className}>
      <div className="flex items-center gap-1">
        <span className="truncate">{label}</span>
        {sorted && (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        <FilterPopover selected={filters[colKey] ?? []} options={options} sorted={sorted}
          onApply={(vals) => { const f = { ...filters }; if (vals.length) f[colKey] = vals; else delete f[colKey]; setFilters(f); }}
          onSort={(dir) => setSort({ key: colKey, dir })} />
      </div>
    </th>
  );
}

export function FilterPopover({ selected, options, sorted, onApply, onSort, extra }: {
  selected: string[]; options: Opts; sorted: boolean; onApply: (vals: string[]) => void; onSort: (dir: "asc" | "desc") => void;
  extra?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Filtrar coluna" onMouseDown={(e) => e.stopPropagation()} className={`p-0.5 rounded hover:bg-accent ${selected.length || sorted ? "text-primary" : "text-muted-foreground"}`}><Filter className="h-3 w-3" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 text-xs font-normal normal-case tracking-normal">
        {open && <Panel initial={selected} options={options} close={() => setOpen(false)} onApply={onApply} onSort={onSort} extra={extra} />}
      </PopoverContent>
    </Popover>
  );
}

function Panel({ initial, options, close, onApply, onSort, extra }: {
  initial: string[]; options: Opts; close: () => void; onApply: (v: string[]) => void; onSort: (d: "asc" | "desc") => void; extra?: (close: () => void) => React.ReactNode;
}) {
  const { total, options: opts } = useMemo(options, []); // computed once per opening
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const shown = opts.filter((o) => o.value.toLowerCase().includes(q.toLowerCase()));
  const apply = (v: string[]) => { onApply(v); close(); };
  return (
    <>
      <div className="flex gap-1 mb-2">
        <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => { onSort("asc"); close(); }}><ArrowUp className="h-3 w-3 mr-1" />Crescente</Button>
        <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => { onSort("desc"); close(); }}><ArrowDown className="h-3 w-3 mr-1" />Decrescente</Button>
      </div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar..." className="h-7 w-full rounded border bg-background px-2 mb-1"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") apply([...sel]); }} />
      <div className="flex justify-between mb-1">
        <button type="button" className="underline" onClick={() => setSel(new Set([...sel, ...shown.map((o) => o.value)]))}>Selecionar todos ({total})</button>
        <button type="button" className="underline" onClick={() => setSel(new Set())}>Limpar seleção</button>
      </div>
      <div className="max-h-64 overflow-auto border rounded p-1 space-y-0.5">
        {shown.map((o) => (
          <label key={o.value} className="flex items-center gap-2 px-1 py-0.5 hover:bg-muted rounded cursor-pointer">
            <Checkbox checked={sel.has(o.value)} onCheckedChange={(c) => { const s = new Set(sel); if (c === true) s.add(o.value); else s.delete(o.value); setSel(s); }} />
            <span className="truncate flex-1">{o.value}</span>
            <span className="text-muted-foreground tabular-nums">({o.count})</span>
          </label>
        ))}
        {!shown.length && <div className="text-muted-foreground p-1">Nenhum valor</div>}
      </div>
      <div className="flex gap-1 mt-2">
        <Button size="sm" className="h-7 flex-1" onClick={() => apply([...sel])}>Aplicar</Button>
        {initial.length > 0 && <Button size="sm" variant="ghost" className="h-7" onClick={() => apply([])}><X className="h-3 w-3 mr-1" />Limpar</Button>}
      </div>
      {extra?.(close)}
    </>
  );
}
