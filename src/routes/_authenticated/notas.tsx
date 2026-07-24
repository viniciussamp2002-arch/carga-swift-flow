import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { StatusBadge } from "@/components/StatusBadge";
import { NOTA_STATUS_LABEL, NOTA_STATUS_COLOR, fmtKg, fmtNum, fmtDate } from "@/lib/format";
import { parseNFeXml } from "@/lib/xml-parser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Plus, PackagePlus, X, ArrowUp, ArrowDown, Filter, FileDown, ChevronDown, Trash2, CalendarCog } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() }).optional();

export const Route = createFileRoute("/_authenticated/notas")({
  component: NotasPage,
  validateSearch: searchSchema,
});

type SortDir = "asc" | "desc" | null;
type ColKey =
  | "data_chegada" | "numero" | "fornecedor" | "cliente" | "cidade"
  | "peso" | "agendamento" | "carga" | "status";

function NotasPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openManual, setOpenManual] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);
  const [openBulkDate, setOpenBulkDate] = useState(false);
  const [openBulkDelete, setOpenBulkDelete] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [sortKey, setSortKey] = useState<ColKey | null>("data_chegada");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data: notas = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, cargas:carga_id(numero)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const fornecedoresDistintos = useMemo(
    () => Array.from(new Set(notas.map((n: any) => n.fornecedor).filter(Boolean))).sort(),
    [notas]
  );
  const cidadesDistintas = useMemo(
    () => Array.from(new Set(notas.map((n: any) => (n.cidade ? `${n.cidade}${n.uf ? "/" + n.uf : ""}` : "")).filter(Boolean))).sort(),
    [notas]
  );

  const getVal = (n: any, k: ColKey) => {
    switch (k) {
      case "data_chegada": return n.data_chegada ?? "";
      case "numero": return n.numeros_agrupados?.length ? n.numeros_agrupados.join(", ") : n.numero;
      case "fornecedor": return n.fornecedor ?? "";
      case "cliente": return n.cliente ?? "";
      case "cidade": return `${n.cidade ?? ""}${n.uf ? "/" + n.uf : ""}`;
      case "peso": return Number(n.peso ?? 0);
      case "agendamento": return n.agendamento ? "Sim" : "";
      case "carga": return n.cargas ? `#${n.cargas.numero}` : "";
      case "status": return NOTA_STATUS_LABEL[n.status] ?? n.status;
    }
  };

  const filtered = useMemo(() => {
    let rows = notas.filter((n: any) => {
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        const cell = String(getVal(n, k as ColKey) ?? "").toLowerCase();
        if (!cell.includes(v.toLowerCase())) return false;
      }
      return true;
    });
    if (sortKey && sortDir) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const va = getVal(a, sortKey);
        const vb = getVal(b, sortKey);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * dir;
      });
    }
    return rows;
  }, [notas, filters, sortKey, sortDir]);

  const selectedNotes = filtered.filter((n: any) => selected.has(n.id));
  const totals = selectedNotes.reduce(
    (acc: any, n: any) => ({
      peso: acc.peso + Number(n.peso ?? 0),
      clientes: acc.clientes.add(n.cliente),
    }),
    { peso: 0, clientes: new Set() }
  );

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  const updateChegada = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: string }) => {
      const { error } = await supabase.from("notas_fiscais").update({ data_chegada: data }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notas"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const bulkUpdateDate = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: string }) => {
      const { error } = await supabase.from("notas_fiscais").update({ data_chegada: data }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Data atualizada em ${v.ids.length} nota(s)`);
      qc.invalidateQueries({ queryKey: ["notas"] });
      setSelected(new Set());
      setOpenBulkDate(false);
      setBulkDate("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notas_fiscais").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} nota(s) excluída(s)`);
      qc.invalidateQueries({ queryKey: ["notas"] });
      setSelected(new Set());
      setOpenBulkDelete(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function importXml(files: FileList, agrupado: boolean) {
    const parsed: any[] = [];
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      const text = await f.text();
      const p = parseNFeXml(text);
      if ("error" in p) errors.push(`${f.name}: XML inválido`);
      else parsed.push(p);
    }
    if (parsed.length === 0) {
      errors.forEach((e) => toast.error(e));
      return;
    }

    // check duplicates already in DB
    const chaves = parsed.map((p) => p.chave_nfe).filter(Boolean);
    if (chaves.length) {
      const { data: dup } = await supabase
        .from("notas_fiscais")
        .select("chave_nfe, chaves_agrupadas, numero")
        .or(`chave_nfe.in.(${chaves.map((c) => `"${c}"`).join(",")}),chaves_agrupadas.ov.{${chaves.join(",")}}`);
      if (dup && dup.length > 0) {
        toast.error(`Nota(s) já importada(s): ${dup.map((d: any) => d.numero).join(", ")}`);
        return;
      }
    }

    if (agrupado) {
      if (parsed.length < 2) {
        toast.error("Selecione pelo menos 2 XMLs para importação agrupada.");
        return;
      }
      const first = parsed[0];
      const mismatch = parsed.find(
        (p) => p.fornecedor !== first.fornecedor || p.cliente !== first.cliente
      );
      if (mismatch) {
        toast.error("Erro: XMLs com fornecedor ou cliente diferentes não podem ser agrupados.");
        return;
      }
      const somaPeso = parsed.reduce((s, p) => s + Number(p.peso ?? 0), 0);
      const somaValor = parsed.reduce((s, p) => s + Number(p.valor ?? 0), 0);
      const { error } = await supabase.from("notas_fiscais").insert({
        chave_nfe: first.chave_nfe,
        numero: first.numero,
        serie: first.serie,
        data_emissao: first.data_emissao,
        cnpj_emissor: first.cnpj_emissor,
        fornecedor: first.fornecedor,
        cnpj_destinatario: first.cnpj_destinatario,
        cliente: first.cliente,
        cidade: first.cidade,
        uf: first.uf,
        peso: somaPeso,
        volumes: 0,
        valor: somaValor,
        chaves_agrupadas: parsed.map((p) => p.chave_nfe),
        numeros_agrupados: parsed.map((p) => p.numero),
        origem: "xml",
        status: "disponivel",
      });
      if (error) toast.error(error.message);
      else toast.success(`Importação agrupada: ${parsed.length} notas em 1 linha`);
    } else {
      let ok = 0, err = 0;
      for (const p of parsed) {
        const { error } = await supabase.from("notas_fiscais").insert({
          ...p, volumes: 0, agendamento: false, origem: "xml", status: "disponivel",
        });
        if (error) err++;
        else ok++;
      }
      if (ok) toast.success(`${ok} nota(s) importada(s)`);
      if (err) toast.error(`${err} erro(s) na importação`);
    }
    errors.forEach((e) => toast.error(e));
    qc.invalidateQueries({ queryKey: ["notas"] });
  }

  const indivRef = useRef<HTMLInputElement>(null);
  const grupRef = useRef<HTMLInputElement>(null);

  function exportExcel() {
    const rows = filtered.map((n: any) => ({
      "Data Chegada": n.data_chegada,
      "Nº NF": n.numeros_agrupados?.length ? n.numeros_agrupados.join(", ") : n.numero,
      "Fornecedor": n.fornecedor,
      "Cliente": n.cliente,
      "Cidade": n.cidade,
      "UF": n.uf,
      "Peso (kg)": Number(n.peso ?? 0),
      "Agendamento": n.agendamento ? "Sim" : "Não",
      "Carga": n.cargas ? `#${n.cargas.numero}` : "",
      "Status": NOTA_STATUS_LABEL[n.status] ?? n.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    XLSX.writeFile(wb, `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function ColHeader({ colKey, label, align = "left", filterOptions }: {
    colKey: ColKey; label: string; align?: "left" | "right"; filterOptions?: string[];
  }) {
    const active = filters[colKey];
    const isSorted = sortKey === colKey;
    return (
      <th className={align === "right" ? "text-right" : ""}>
        <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
          <span>{label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`p-0.5 rounded hover:bg-accent ${active || isSorted ? "text-primary" : "text-muted-foreground"}`}>
                <Filter className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => { setSortKey(colKey); setSortDir("asc"); }}>
                <ArrowUp className="h-3.5 w-3.5 mr-2" /> Ordem crescente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortKey(colKey); setSortDir("desc"); }}>
                <ArrowDown className="h-3.5 w-3.5 mr-2" /> Ordem decrescente
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px]">Filtrar</DropdownMenuLabel>
              <div className="p-2 pt-1">
                {filterOptions ? (
                  <Select
                    value={filters[colKey] ?? "__all__"}
                    onValueChange={(v) => setFilters({ ...filters, [colKey]: v === "__all__" ? "" : v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {filterOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={filters[colKey] ?? ""}
                    onChange={(e) => setFilters({ ...filters, [colKey]: e.target.value })}
                    className="h-8"
                    placeholder="Contém..."
                  />
                )}
              </div>
              {(active || isSorted) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      const f = { ...filters }; delete f[colKey]; setFilters(f);
                      if (isSorted) { setSortKey(null); setSortDir(null); }
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-2" /> Limpar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </th>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle={`${fmtNum(filtered.length)} de ${fmtNum(notas.length)} notas`}
        actions={
          <>
            {canWrite && (
              <>
                <input ref={indivRef} type="file" accept=".xml" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) importXml(e.target.files, false); e.target.value = ""; }} />
                <input ref={grupRef} type="file" accept=".xml" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) importXml(e.target.files, true); e.target.value = ""; }} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Upload className="h-4 w-4 mr-1" /> Importar XML <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem onClick={() => indivRef.current?.click()}>
                      <div>
                        <div className="font-medium">Individual</div>
                        <div className="text-[11px] text-muted-foreground">Uma linha por XML</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => grupRef.current?.click()}>
                      <div>
                        <div className="font-medium">Agrupado</div>
                        <div className="text-[11px] text-muted-foreground">Vários XMLs em uma linha (mesmo fornecedor e cliente)</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setOpenManual(true)} variant="outline" size="sm" className="h-9">
                  <Plus className="h-4 w-4 mr-1" />Manual
                </Button>
              </>
            )}
            <Button onClick={exportExcel} variant="outline" size="sm" className="h-9">
              <FileDown className="h-4 w-4 mr-1" /> Exportar Excel
            </Button>
          </>
        }
      />

      {canWrite && selected.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
          <span className="font-semibold">{selected.size} selecionada(s)</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => { setBulkDate(""); setOpenBulkDate(true); }}
            >
              <CalendarCog className="h-3.5 w-3.5 mr-1" /> Editar data
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={() => setOpenBulkDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 bg-card border rounded-md overflow-hidden">
          <div className="max-h-[calc(100vh-220px)] overflow-auto">
            <table className="table-erp">
              <thead>
                <tr>
                  <th className="w-8">
                    {canWrite && filtered.length > 0 && (
                      <input
                        type="checkbox"
                        checked={filtered.every((n: any) => selected.has(n.id))}
                        ref={(el) => {
                          if (el) {
                            const some = filtered.some((n: any) => selected.has(n.id));
                            const all = filtered.every((n: any) => selected.has(n.id));
                            el.indeterminate = some && !all;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) setSelected(new Set(filtered.map((n: any) => n.id)));
                          else setSelected(new Set());
                        }}
                      />
                    )}
                  </th>
                  <ColHeader colKey="data_chegada" label="Data Chegada" />
                  <ColHeader colKey="numero" label="Nº NF" />
                  <ColHeader colKey="fornecedor" label="Fornecedor" filterOptions={fornecedoresDistintos as string[]} />
                  <ColHeader colKey="cliente" label="Cliente" />
                  <ColHeader colKey="cidade" label="Cidade/UF" filterOptions={cidadesDistintas as string[]} />
                  <ColHeader colKey="peso" label="Peso" align="right" />
                  <ColHeader colKey="agendamento" label="Agend" />
                  <ColHeader colKey="carga" label="Carga" />
                  <ColHeader colKey="status" label="Status" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((n: any) => {
                  const sel = selected.has(n.id);
                  const numeroDisplay = n.numeros_agrupados?.length
                    ? n.numeros_agrupados.join(" + ")
                    : n.numero;
                  return (
                    <tr key={n.id} className={sel ? "bg-primary/5" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel}
                          disabled={!canWrite}
                          onChange={() => toggle(n.id)}
                        />
                      </td>
                      <td>
                        {canWrite ? (
                          <Input
                            type="date"
                            defaultValue={n.data_chegada ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v && v !== n.data_chegada) updateChegada.mutate({ id: n.id, data: v });
                            }}
                            className="h-8 w-36"
                          />
                        ) : fmtDate(n.data_chegada)}
                      </td>
                      <td className="font-mono">
                        {n.numeros_agrupados?.length > 1 ? (
                          <Popover>
                            <PopoverTrigger className="underline decoration-dotted">
                              {n.numeros_agrupados.length} notas
                            </PopoverTrigger>
                            <PopoverContent className="text-xs">
                              <div className="font-semibold mb-1">Notas agrupadas</div>
                              {n.numeros_agrupados.map((num: string) => <div key={num}>{num}</div>)}
                            </PopoverContent>
                          </Popover>
                        ) : numeroDisplay}
                      </td>
                      <td className="max-w-[200px] truncate">{n.fornecedor}</td>
                      <td className="max-w-[200px] truncate">{n.cliente}</td>
                      <td>{n.cidade}{n.uf && `/${n.uf}`}</td>
                      <td className="text-right">{fmtKg(n.peso)}</td>
                      <td>{n.agendamento ? "Sim" : "—"}</td>
                      <td>{n.cargas ? `#${n.cargas.numero}` : "—"}</td>
                      <td><StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma nota encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected.size > 0 && (
          <aside className="w-72 bg-card border rounded-md p-4 h-fit sticky top-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">Carga em formação</h3>
              <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Notas</span><span className="font-bold">{selected.size}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peso total</span><span className="font-bold">{fmtKg(totals.peso)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Clientes</span><span className="font-bold">{totals.clientes.size}</span></div>
            </div>
            <Button onClick={() => setOpenCarga(true)} className="w-full mt-4" size="sm">
              <PackagePlus className="h-4 w-4 mr-2" />GERAR CARGA
            </Button>
          </aside>
        )}
      </div>

      <ManualDialog open={openManual} onOpenChange={setOpenManual} />
      <GerarCargaDialog
        open={openCarga}
        onOpenChange={(o) => { setOpenCarga(o); if (!o) setSelected(new Set()); }}
        notaIds={Array.from(selected)}
      />
    </div>
  );
}

function ManualDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "",
    fornecedor: "", agendamento: false, observacoes: "",
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notas_fiscais").insert({
        ...form,
        peso: Number(form.peso) || 0,
        volumes: 0,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota cadastrada");
      qc.invalidateQueries({ queryKey: ["notas"] });
      onOpenChange(false);
      setForm({ numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "", fornecedor: "", agendamento: false, observacoes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cadastrar Nota Manual</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número NF*"><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
          <Field label="Fornecedor"><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></Field>
          <Field label="Cliente" className="col-span-2"><Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Field>
          <Field label="UF"><Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} maxLength={2} /></Field>
          <Field label="Região"><Input value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} /></Field>
          <Field label="Peso (kg)"><Input type="number" step="0.001" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} /></Field>
          <Field label="Agendamento">
            <div className="flex items-center h-9"><Switch checked={form.agendamento} onCheckedChange={(v) => setForm({ ...form, agendamento: v })} /></div>
          </Field>
          <Field label="Observações" className="col-span-2"><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.numero}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}

function GerarCargaDialog({
  open, onOpenChange, notaIds,
}: { open: boolean; onOpenChange: (o: boolean) => void; notaIds: string[] }) {
  const qc = useQueryClient();
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas-disp"],
    queryFn: async () => (await supabase.from("motoristas").select("id,nome").eq("situacao", "disponivel")).data ?? [],
    enabled: open,
  });
  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-disp"],
    queryFn: async () => (await supabase.from("veiculos").select("id,placa,modelo").eq("situacao", "disponivel")).data ?? [],
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: carga, error } = await supabase.from("cargas").insert({
        motorista_id: motorista || null, veiculo_id: veiculo || null,
        data_prevista_saida: data || null, observacoes: obs, status: "separacao",
      }).select().single();
      if (error) throw error;
      const upd = await supabase.from("notas_fiscais").update({
        carga_id: carga.id, status: "separacao",
      }).in("id", notaIds);
      if (upd.error) throw upd.error;
      await supabase.from("historico").insert(notaIds.map((nid) => ({
        entidade: "nota", entidade_id: nid, acao: "vinculo_carga",
        descricao: `Nota vinculada à carga #${carga.numero}`,
      })));
      await supabase.from("historico").insert({
        entidade: "carga", entidade_id: carga.id, acao: "criada",
        descricao: `Carga #${carga.numero} criada com ${notaIds.length} nota(s)`,
      });
      return carga;
    },
    onSuccess: (c: any) => {
      toast.success(`Carga #${c.numero} criada!`);
      qc.invalidateQueries();
      onOpenChange(false);
      setMotorista(""); setVeiculo(""); setData(""); setObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar Carga ({notaIds.length} nota(s))</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Motorista">
            <Select value={motorista} onValueChange={setMotorista}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{motoristas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Veículo">
            <Select value={veiculo} onValueChange={setVeiculo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} • {v.modelo}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Data prevista"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
          <Field label="Observações"><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Criar Carga</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
