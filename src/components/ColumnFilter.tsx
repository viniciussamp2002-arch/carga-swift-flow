import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ColFilters, ColSort } from "@/lib/column-filters";

/** Column header with Excel-like filter: value list, search, multi-select, select all, clear, apply and sort. */
export function FilterTh({ label, colKey, values, filters, setFilters, sort, setSort, className = "" }: {
  label: React.ReactNode; colKey: string; values: string[]; filters: ColFilters; setFilters: (f: ColFilters) => void;
  sort: ColSort; setSort: (s: ColSort) => void; className?: string;
}) {
  const active = (filters[colKey]?.length ?? 0) > 0;
  const sorted = sort?.key === colKey;
  return (
    <th className={className}>
      <div className="flex items-center gap-1">
        <span className="truncate">{label}</span>
        {sorted && (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        <FilterPopover colKey={colKey} values={values} filters={filters} setFilters={setFilters} setSort={setSort} highlight={active || sorted} />
      </div>
    </th>
  );
}

function FilterPopover({ colKey, values, filters, setFilters, setSort, highlight }: {
  colKey: string; values: string[]; filters: ColFilters; setFilters: (f: ColFilters) => void; setSort: (s: ColSort) => void; highlight: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const shown = useMemo(() => values.filter((v) => v.toLowerCase().includes(q.toLowerCase())), [values, q]);
  const onOpen = (o: boolean) => { setOpen(o); if (o) { setQ(""); setSel(new Set(filters[colKey] ?? [])); } };
  const apply = (vals: string[]) => { const f = { ...filters }; if (vals.length) f[colKey] = vals; else delete f[colKey]; setFilters(f); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Filtrar coluna" className={`p-0.5 rounded hover:bg-accent ${highlight ? "text-primary" : "text-muted-foreground"}`}><Filter className="h-3 w-3" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-xs font-normal normal-case tracking-normal">
        <div className="flex gap-1 mb-2">
          <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => { setSort({ key: colKey, dir: "asc" }); setOpen(false); }}><ArrowUp className="h-3 w-3 mr-1" />Crescente</Button>
          <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => { setSort({ key: colKey, dir: "desc" }); setOpen(false); }}><ArrowDown className="h-3 w-3 mr-1" />Decrescente</Button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar..." className="h-7 w-full rounded border bg-background px-2 mb-1" onKeyDown={(e) => e.stopPropagation()} />
        <div className="flex justify-between mb-1">
          <button type="button" className="underline" onClick={() => setSel(new Set([...sel, ...shown]))}>Selecionar todos</button>
          <button type="button" className="underline" onClick={() => setSel(new Set())}>Limpar seleção</button>
        </div>
        <div className="max-h-56 overflow-auto border rounded p-1 space-y-0.5">
          {shown.map((v) => (
            <label key={v} className="flex items-center gap-2 px-1 py-0.5 hover:bg-muted rounded cursor-pointer">
              <Checkbox checked={sel.has(v)} onCheckedChange={(c) => { const s = new Set(sel); if (c === true) s.add(v); else s.delete(v); setSel(s); }} />
              <span className="truncate">{v}</span>
            </label>
          ))}
          {!shown.length && <div className="text-muted-foreground p-1">Nenhum valor</div>}
        </div>
        <div className="flex gap-1 mt-2">
          <Button size="sm" className="h-7 flex-1" onClick={() => apply([...sel])}>Aplicar</Button>
          {(filters[colKey]?.length ?? 0) > 0 && <Button size="sm" variant="ghost" className="h-7" onClick={() => apply([])}><X className="h-3 w-3 mr-1" />Limpar</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
