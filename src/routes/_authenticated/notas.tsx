import { pageHead } from "@/lib/page-head";
import { OcorrenciaBadge, OcorrenciaGrupoBadge, useOcorrencias } from "@/components/Ocorrencias";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { DepositoTabs } from "@/components/DepositoTabs";
import { AG_STATUS_LABEL } from "@/lib/agenda";
import { StatusBadge } from "@/components/StatusBadge";
import { NOTA_STATUS_LABEL, NOTA_STATUS_COLOR, fmtKg, fmtNum, fmtDate, fmtBRL } from "@/lib/format";
import { lerXmls } from "@/lib/nfe-import";
import { occurrenceState } from "@/lib/occurrence-rules";
import { recipientGroupKey } from "@/lib/nfe-rules";
import { rowsPassingOtherFilters, valueCounts } from "@/lib/column-option-counts";
import { useAuth } from "@/hooks/useAuth";
import { BaixaDiretaDialog } from "@/components/BaixaDiretaDialog";
import { RotaEntregaDialog } from "@/components/RotaEntregaDialog";
import { toast } from "sonner";
import { classificarPrazo, hojeTeresina, permanencia, PRAZO_CLASS, PRAZO_LABEL, type Prazo } from "@/lib/deadline-rules";
import { AlertTriangle, CalendarClock, ListChecks, Truck } from "lucide-react";
import { Upload, Plus, PackagePlus, X, ArrowUp, ArrowDown, Filter, FileDown, ChevronDown, Trash2, CalendarCog, Search, EyeOff, Columns3, Printer, CheckCircle2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() }).optional();

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => pageHead("Notas Fiscais / Depósito", "Controle operacional de notas fiscais recebidas."),
  component: NotasPage,
  validateSearch: searchSchema,
});

type SortDir = "asc" | "desc" | null;
type EditType = "date" | "text" | "number" | "int" | "bool";
interface ColDef {
  key: string; label: string; width: number; align?: "right";
  get: (n: any) => string | number;
  render?: (n: any) => React.ReactNode;
  edit?: { field: string; type: EditType };
  options?: boolean;
}

const COLS: ColDef[] = [
  { key: "data_chegada", label: "Recebimento", width: 120, get: (n) => n.data_chegada ?? "", render: (n) => <span title={permanencia(n.data_chegada, hojeTeresina())}>{fmtDate(n.data_chegada ? n.data_chegada + "T12:00:00" : null)} <span className="text-[10px] text-muted-foreground">· {permanencia(n.data_chegada, hojeTeresina()).replace("Recebida hoje", "hoje").replace(/ dias? no depósito/, "d").replace("Sem data de recebimento", "")}</span></span>, edit: { field: "data_chegada", type: "date" } },
  { key: "transportadora", label: "Transportadora", width: 180, options: true, get: (n) => n.entrada?.transportadora ?? "" },
  { key: "transporte", label: "Transporte", width: 130, options: true, get: (n) => n.entrada?.numero_transporte ?? "", render: (n) => n.entrada?.numero_transporte || "—" },
  { key: "numero", label: "Nº NF", width: 110, get: (n) => (n.numeros_agrupados?.length ? n.numeros_agrupados.join(", ") : n.numero) },
  { key: "fornecedor", label: "Fornecedor", width: 180, get: (n) => n.fornecedor ?? "", options: true },
  { key: "cliente", label: "Cliente", width: 200, get: (n) => n.cliente ?? "", edit: { field: "cliente", type: "text" } },
  { key: "cidade", label: "Cidade", width: 140, get: (n) => n.cidade ?? "", options: true, edit: { field: "cidade", type: "text" } },
  { key: "uf", label: "UF", width: 50, get: (n) => n.uf ?? "", edit: { field: "uf", type: "text" } },
  { key: "peso", label: "Peso (kg)", width: 110, align: "right", get: (n) => Number(n.peso ?? 0), render: (n) => fmtNum(n.peso, 3), edit: { field: "peso", type: "number" } },
  { key: "volumes", label: "Volumes", width: 80, align: "right", get: (n) => Number(n.volumes ?? 0), edit: { field: "volumes", type: "int" } },
  { key: "valor", label: "Valor NF", width: 120, align: "right", get: (n) => Number(n.valor ?? 0), render: (n) => fmtBRL(n.valor) },
  { key: "previsao_entrega", label: "Previsão entrega", width: 170, get: (n) => n.previsao_entrega ?? "9999-12-31",
    render: (n) => { const c = classificarPrazo(n.previsao_entrega, hojeTeresina());
      const a = Array.isArray(n.agendamentos) ? n.agendamentos[0] : n.agendamentos;
      const diverge = n.previsao_entrega && a?.status === "confirmado" && a.data_agendada && n.previsao_entrega > a.data_agendada;
      return <span className={PRAZO_CLASS[c.prazo]} title={c.texto}>
        {n.previsao_entrega ? `${fmtDate(n.previsao_entrega + "T12:00:00")} · ` : ""}{c.texto === "No prazo" ? `${c.dias}d` : c.texto}
        {diverge && <AlertTriangle aria-label="Previsão depois do agendamento confirmado" className="inline h-3 w-3 ml-1 text-destructive" />}</span>; } },
  { key: "status", label: "Status", width: 110, get: (n) => NOTA_STATUS_LABEL[n.status] ?? n.status, options: true, render: (n) => <StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge> },
  { key: "agendamento", label: "Agendamento", width: 150, options: true,
    get: (n) => { const a = Array.isArray(n.agendamentos) ? n.agendamentos[0] : n.agendamentos;
      return a ? `${AG_STATUS_LABEL[a.status]}${a.data_agendada ? " " + a.data_agendada.split("-").reverse().join("/") : ""}` : n.agendamento ? "Sim" : "Não"; },
    render: (n) => { const a = Array.isArray(n.agendamentos) ? n.agendamentos[0] : n.agendamentos;
      if (!a) return n.agendamento ? "Sim" : "—";
      const pend = a.status === "nao_solicitado" || a.status === "solicitado" || a.status === "aguardando_confirmacao";
      return <StatusBadge className={pend ? "bg-warning/15 text-warning-foreground border-warning/40" : "bg-info/15 text-info border-info/30"}>
        {AG_STATUS_LABEL[a.status]}{a.data_agendada ? ` ${a.data_agendada.split("-").reverse().join("/")}` : ""}</StatusBadge>; } },
  { key: "motorista", label: "Motorista", width: 140, get: (n) => n.cargas?.motoristas?.nome ?? "", options: true },
  { key: "observacoes", label: "Observações", width: 200, get: (n) => n.observacoes ?? "", edit: { field: "observacoes", type: "text" } },
];
const COL_MAP = Object.fromEntries(COLS.map((c) => [c.key, c]));
const PAGE = 100;
interface View { order: string[]; hidden: string[]; widths: Record<string, number> }
const DEFAULT_VIEW: View = { order: COLS.map((c) => c.key), hidden: [], widths: {} };

function NotasPage() {
  const { canWrite, user } = useAuth();
  const { q } = Route.useSearch() ?? {};
  const qc = useQueryClient();
  const [modoXml, setModoXml] = useState<"individual" | "agrupada">("individual");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const [resultadoXml, setResultadoXml] = useState<{ importadas: number; erros: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baixaNota, setBaixaNota] = useState<any>(null);
  const [rotaOpen, setRotaOpen] = useState(false);
  const [openManual, setOpenManual] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);
  const [openBulkDate, setOpenBulkDate] = useState(false);
  const [openBulkDelete, setOpenBulkDelete] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [prazoFiltro, setPrazoFiltro] = useState<Prazo | null>(null);
  const [openPrev, setOpenPrev] = useState(false);
  const [prevData, setPrevData] = useState("");
  const [prevObs, setPrevObs] = useState("");
  const [hoje, setHoje] = useState(() => hojeTeresina());
  useEffect(() => { const t = setInterval(() => setHoje(hojeTeresina()), 60000); return () => clearInterval(t); }, []);
  const [sortKey, setSortKey] = useState<string | null>("data_chegada");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState(q ?? "");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [active, setActive] = useState<{ id: string; key: string } | null>(null);
  const dragCol = useRef<string | null>(null);
  const viewKey = `notas-view-${user?.id ?? "anon"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewKey);
      if (raw) {
        const v = JSON.parse(raw) as View;
        const existing = [...v.order.filter((k) => COL_MAP[k] && k !== "transportadora" && k !== "transporte"), ...COLS.map((c) => c.key).filter((k) => k !== "transportadora" && k !== "transporte" && !v.order.includes(k))];
        const order = [...existing.slice(0, 1), "transportadora", "transporte", ...existing.slice(1)];
        setView({ order, hidden: v.hidden ?? [], widths: v.widths ?? {} });
      }
    } catch { /* ignore */ }
  }, [viewKey]);
  const saveView = (v: View) => { setView(v); localStorage.setItem(viewKey, JSON.stringify(v)); };
  const cols = view.order.filter((k) => !view.hidden.includes(k)).map((k) => COL_MAP[k]);

  const occurrenceMap = useOcorrencias();
  const { data: fiscalNotes = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: async () => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("notas_fiscais")
          .select("*, cargas:carga_id(numero, status, motoristas:motorista_id(nome)), agendamentos(status, data_agendada), entrada:carga_entrada_id(transportadora, numero_transporte)")
          .eq("recebida", true)
          .neq("status", "entregue")
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const notas = useMemo(() => fiscalNotes.map(n => ({ ...n, ocorrencia_estado: occurrenceState(occurrenceMap.get(n.id)) })), [fiscalNotes, occurrenceMap]);

  const optionsFor = (k: string) =>
    Array.from(new Set(notas.map((n: any) => String(COL_MAP[k].get(n))).filter(Boolean))).sort();

  const matchesColumnFilter = (n: any, k: string, v: string) => {
    if (k === "ocorrencias" && v === "Histórico de ocorrência") return n.ocorrencia_estado !== "Sem ocorrência";
    const col = COL_MAP[k];
    if (!col) return true;
    const cell = String(col.get(n) ?? "").toLowerCase();
    return col.options ? cell === v.toLowerCase() : cell.includes(v.toLowerCase());
  };
  const matchesSearch = (n: any, term: string) => !term || COLS.some((c) => String(c.get(n)).toLowerCase().includes(term));

  /** Quantas notas cada opção do filtro devolve: busca, prazo e demais filtros, sem o filtro da própria coluna. */
  const countsFor = (k: string) => {
    const term = busca.trim().toLowerCase();
    const base = notas.filter((n: any) => matchesSearch(n, term)
      && (!prazoFiltro || classificarPrazo(n.previsao_entrega, hoje).prazo === prazoFiltro));
    const rows = rowsPassingOtherFilters(base, filters, k, matchesColumnFilter);
    return { total: rows.length, counts: valueCounts(rows, (n: any) => String(COL_MAP[k]?.get(n) ?? "")) };
  };

  const baseFiltered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    let rows = notas.filter((n: any) => matchesSearch(n, term)
      && Object.entries(filters).every(([k, v]) => !v || matchesColumnFilter(n, k, v)));
    if (sortKey && sortDir) {
      const dir = sortDir === "asc" ? 1 : -1;
      const g = COL_MAP[sortKey].get;
      rows = [...rows].sort((a, b) => {
        const va = g(a), vb = g(b);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * dir;
      });
    }
    return rows;
  }, [notas, filters, sortKey, sortDir, busca, hoje]);
  const prazoCount = useMemo(() => { const c: Record<Prazo, number> = { no_prazo: 0, proximo: 0, vencido: 0, sem_previsao: 0 };
    baseFiltered.forEach((n: any) => { c[classificarPrazo(n.previsao_entrega, hoje).prazo]++; }); return c; }, [baseFiltered, hoje]);
  const filtered = useMemo(() => prazoFiltro ? baseFiltered.filter((n: any) => classificarPrazo(n.previsao_entrega, hoje).prazo === prazoFiltro) : baseFiltered, [baseFiltered, prazoFiltro, hoje]);
  const salvarPrevisao = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("definir_previsao_entrega", { _ids: Array.from(selected), _data: prevData, _obs: prevObs });
      if (error) throw error; return data as number;
    },
    onSuccess: (n) => { toast.success(`Previsão salva em ${n} nota(s)`); setOpenPrev(false); setSelected(new Set()); qc.invalidateQueries({ queryKey: ["notas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => { setPage(0); }, [filters, busca, sortKey, sortDir, prazoFiltro]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const sum = (rows: any[]) => rows.reduce(
    (a, n) => ({ peso: a.peso + Number(n.peso ?? 0), volumes: a.volumes + Number(n.volumes ?? 0), valor: a.valor + Number(n.valor ?? 0) }),
    { peso: 0, volumes: 0, valor: 0 });
  const totFiltro = useMemo(() => sum(filtered), [filtered]);
  const selectedNotes = notas.filter((n: any) => selected.has(n.id));
  const totSel = sum(selectedNotes);
  const cidadesSel = Array.from(new Set(selectedNotes.map((n: any) => `${n.cidade}${n.uf ? "/" + n.uf : ""}`).filter(Boolean)));

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  const updateCell = useMutation({
    mutationFn: async ({ n, col, raw }: { n: any; col: ColDef; raw: string | boolean }) => {
      const e = col.edit;
      if (!e) return false;
      let value: any = raw;
      if (e.type === "number") { value = Number(String(raw).replace(/\./g, "").replace(",", ".")); if (isNaN(value) || value < 0) throw new Error("Valor numérico inválido"); }
      if (e.type === "int") { value = parseInt(String(raw), 10); if (isNaN(value) || value < 0) throw new Error("Quantidade inválida"); }
      if (e.type === "date") { if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) throw new Error("Data inválida"); value = raw || null; if (e.field === "data_chegada" && !value) throw new Error("Data de recebimento é obrigatória"); }
      if (e.type === "text") value = String(raw).trim();
      if (e.field === "uf") value = String(value).toUpperCase().slice(0, 2);
      const old = n[e.field];
      if (String(old ?? "") === String(value ?? "")) return false;
      const { error } = await supabase.from("notas_fiscais").update({ [e.field]: value } as any).eq("id", n.id);
      if (error) throw error;
      await supabase.from("historico").insert({
        entidade: "nota", entidade_id: n.id, acao: "edicao", user_id: user?.id,
        descricao: `NF ${n.numero} — ${col.label}: "${old ?? ""}" → "${value ?? ""}"`,
      });
      return true;
    },
    onSuccess: (changed) => { if (changed) qc.invalidateQueries({ queryKey: ["notas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkUpdateDate = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: string }) => {
      const { error } = await supabase.from("notas_fiscais").update({ data_chegada: data }).in("id", ids);
      if (error) throw error;
      await supabase.from("historico").insert(ids.map((id) => ({ entidade: "nota", entidade_id: id, acao: "edicao", user_id: user?.id, descricao: `Recebimento alterado em lote para ${data}` })));
    },
    onSuccess: (_d, v) => {
      toast.success(`Data atualizada em ${v.ids.length} nota(s)`);
      qc.invalidateQueries({ queryKey: ["notas"] });
      setSelected(new Set()); setOpenBulkDate(false); setBulkDate("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.from("notas_fiscais").delete().in("id", ids).select("id");
      if (error) throw error;
      if ((data?.length ?? 0) < ids.length) throw new Error(`${ids.length - (data?.length ?? 0)} nota(s) não excluída(s): sem permissão`);
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} nota(s) excluída(s)`);
      qc.invalidateQueries({ queryKey: ["notas"] });
      setSelected(new Set()); setOpenBulkDelete(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function importXml(files: FileList, agrupado: boolean) {
    setImportando(true);
    try {
      const { ok, erros, nomes } = await lerXmls(files);
      const groups = new Map<string, string>();
      let importadas = 0;
      for (const p of ok) {
        const recipient = p.cnpj_destinatario.replace(/\D/g, "");
        if (agrupado && !recipient) { erros.push(`${nomes.get(p.chave_nfe)}: destinatário sem CNPJ/CPF; importe individualmente`); continue; }
        if (!groups.has(recipient)) groups.set(recipient, crypto.randomUUID());
        const { error } = await supabase.from("notas_fiscais").insert({
          ...p, origem: "xml", status: "disponivel", recebida_em: new Date().toISOString(), recebida_por: user?.id,
          grupo_importacao: agrupado ? groups.get(recipient) : null,
        });
        if (error) erros.push(`${nomes.get(p.chave_nfe)}: ${error.code === "23505" ? "NF já cadastrada; não foi duplicada" : error.message}`);
        else importadas++;
      }
      setModoXml(agrupado ? "agrupada" : "individual");
      setResultadoXml({ importadas, erros });
      qc.invalidateQueries({ queryKey: ["notas"] });
    } catch (e: any) { setResultadoXml({ importadas: 0, erros: [e?.message ?? "Falha ao ler os arquivos"] }); } finally { setImportando(false); }
  }

  async function importExcel(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const pick = (r: any, ...names: string[]) => {
      for (const k of Object.keys(r)) if (names.includes(norm(k))) return r[k];
      return "";
    };
    const toDate = (v: any) => v instanceof Date ? v.toISOString().slice(0, 10)
      : /^\d{2}\/\d{2}\/\d{4}$/.test(String(v)) ? String(v).split("/").reverse().join("-")
      : /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null;
    const toNum = (v: any) => typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
    const existentes = new Set(notas.map((n: any) => `${n.numero}|${n.fornecedor}`));
    const ins: any[] = []; let dup = 0, semNumero = 0;
    for (const r of rows) {
      const numero = String(pick(r, "nnf", "nf", "numero", "notafiscal", "nota")).trim();
      if (!numero) { semNumero++; continue; }
      const fornecedor = String(pick(r, "fornecedor", "emitente")).trim();
      if (existentes.has(`${numero}|${fornecedor}`)) { dup++; continue; }
      existentes.add(`${numero}|${fornecedor}`);
      ins.push({
        numero, fornecedor, cliente: String(pick(r, "cliente", "destinatario")).trim(),
        cidade: String(pick(r, "cidade")).trim(), uf: String(pick(r, "uf")).trim().toUpperCase().slice(0, 2) || null,
        peso: toNum(pick(r, "pesokg", "peso")), volumes: Math.round(toNum(pick(r, "volumes", "volume"))),
        valor: toNum(pick(r, "valornf", "valor", "valordanota")),
        data_chegada: toDate(pick(r, "datachegada", "recebimento", "datarecebimento")) ?? new Date().toISOString().slice(0, 10),
        data_limite: toDate(pick(r, "previsaoentrega", "previsao")),
        observacoes: String(pick(r, "observacoes", "obs")).trim() || null,
        origem: "planilha", status: "disponivel", recebida_em: new Date().toISOString(), recebida_por: user?.id,
      });
    }
    if (ins.length) {
      const { error } = await supabase.from("notas_fiscais").insert(ins);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${ins.length} nota(s) importada(s)${dup ? ` • ${dup} já existiam` : ""}${semNumero ? ` • ${semNumero} sem número ignorada(s)` : ""}`);
    qc.invalidateQueries({ queryKey: ["notas"] });
  }

  const indivRef = useRef<HTMLInputElement>(null);
  const grupRef = useRef<HTMLInputElement>(null);
  const xlsRef = useRef<HTMLInputElement>(null);

  function exportExcel() {
    const rows = filtered.map((n: any) => Object.fromEntries(cols.map((c) => [c.label, c.get(n)])));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    XLSX.writeFile(wb, `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function printTable() {
    const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
    const fmt = (v: any) => typeof v === "number" ? v.toLocaleString("pt-BR") : v;
    const filtros = [busca.trim() && `Busca: ${busca.trim()}`, ...Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${COL_MAP[k]?.label ?? k}: ${v}`)].filter(Boolean).join(" | ") || "Nenhum";
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const body = filtered.map((n: any) => `<tr>${cols.map((c) => `<td>${esc(fmt(c.get(n)))}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Notas Fiscais</title><style>
      @page{size:A4 landscape;margin:10mm}*{color:#000!important;background:#fff!important}
      body{font-family:Arial,sans-serif;font-size:10px;margin:0}h1{font-size:14px;margin:0 0 4px}p{margin:2px 0}
      table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #000;padding:2px 4px;text-align:left;vertical-align:top}
      th{font-weight:bold}thead{display:table-header-group}tr{page-break-inside:avoid}</style></head><body>
      <h1>Transmerida — Notas Fiscais / Depósito</h1>
      <p>Emitido em: ${new Date().toLocaleString("pt-BR")}</p><p>Filtros: ${esc(filtros)}</p>
      <p>NFs: ${filtered.length} | Peso: ${totFiltro.peso.toLocaleString("pt-BR")} kg | Volumes: ${totFiltro.volumes.toLocaleString("pt-BR")} | Valor: ${totFiltro.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para imprimir"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  function startResize(e: React.MouseEvent, key: string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = view.widths[key] ?? COL_MAP[key].width;
    let w = startW;
    const move = (ev: MouseEvent) => {
      w = Math.max(50, startW + ev.clientX - startX);
      setView((v) => ({ ...v, widths: { ...v.widths, [key]: w } }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      setView((v) => { localStorage.setItem(viewKey, JSON.stringify(v)); return v; });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  function dropCol(target: string) {
    const from = dragCol.current; dragCol.current = null;
    if (!from || from === target) return;
    const order = view.order.filter((k) => k !== from);
    order.splice(order.indexOf(target), 0, from);
    saveView({ ...view, order });
  }

  async function onKey(e: React.KeyboardEvent) {
    if (editing || !active) return;
    const n = notas.find((x: any) => x.id === active.id);
    const col = COL_MAP[active.key];
    if (!n || !col) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      await navigator.clipboard.writeText(String(col.get(n)));
      toast.success("Copiado");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "v" && canWrite && col.edit) {
      const txt = (await navigator.clipboard.readText()).trim();
      const raw = col.edit.type === "bool" ? /^(sim|s|true|1)$/i.test(txt)
        : col.edit.type === "date" && /^\d{2}\/\d{2}\/\d{4}$/.test(txt) ? txt.split("/").reverse().join("-") : txt;
      if (selected.has(n.id) && selected.size > 1) {
        for (const sn of notas.filter((x: any) => selected.has(x.id))) await updateCell.mutateAsync({ n: sn, col, raw }).catch(() => {});
        toast.success(`Colado em ${selected.size} nota(s)`);
      } else updateCell.mutate({ n, col, raw });
    } else if ((e.key === "Enter" || e.key === "F2") && canWrite && col.edit) {
      e.preventDefault(); setEditing(active);
    }
  }

  function Cell({ n, col }: { n: any; col: ColDef }) {
    const isEdit = editing?.id === n.id && editing?.key === col.key;
    const isActive = active?.id === n.id && active?.key === col.key;
    const editable = canWrite && !!col.edit;
    const commit = (raw: string | boolean) => { setEditing(null); updateCell.mutate({ n, col, raw }); };
    let content: React.ReactNode;
    if (isEdit && col.edit) {
      const cur = n[col.edit.field];
      content = col.edit.type === "bool" ? (
        <select autoFocus defaultValue={cur ? "1" : "0"} className="h-7 w-full border rounded bg-background"
          onChange={(e) => commit(e.target.value === "1")} onBlur={() => setEditing(null)}>
          <option value="1">Sim</option><option value="0">Não</option>
        </select>
      ) : (
        <input autoFocus type={col.edit.type === "date" ? "date" : "text"}
          defaultValue={cur ?? ""} className="h-7 w-full border border-primary rounded px-1 bg-background"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(null);
          }} />
      );
    } else if (col.key === "numero" && n.numeros_agrupados?.length > 1) {
      content = (
        <Popover>
          <PopoverTrigger className="underline decoration-dotted font-mono">{n.numeros_agrupados.length} notas</PopoverTrigger>
          <PopoverContent className="text-xs"><div className="font-semibold mb-1">Notas agrupadas</div>
            {n.numeros_agrupados.map((num: string) => <div key={num}>{num}</div>)}</PopoverContent>
        </Popover>
      );
    } else content = col.render ? col.render(n) : (String(col.get(n)) || "—");
    if (col.key === "numero") content = <>{content}{n.observacoes ? <span title={n.observacoes} aria-label="Tem observação" className="ml-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" /> : null}</>;
    return (
      <td
        key={col.key}
        className={`${col.align === "right" ? "text-right" : ""} ${col.key === "numero" ? "font-mono" : ""} overflow-hidden text-ellipsis ${isActive && !isEdit ? "outline outline-2 -outline-offset-2 outline-primary" : ""} ${editable ? "cursor-cell" : ""}`}
        style={{ maxWidth: view.widths[col.key] ?? col.width }}
        title={editable ? "Duplo clique para editar" : undefined}
        onClick={() => setActive({ id: n.id, key: col.key })}
        onDoubleClick={() => editable && setEditing({ id: n.id, key: col.key })}
      >{content}</td>
    );
  }

  function ColHeader({ col }: { col: ColDef }) {
    const activeF = filters[col.key];
    const isSorted = sortKey === col.key;
    const w = view.widths[col.key] ?? col.width;
    return (
      <th key={col.key} className={`relative select-none ${col.align === "right" ? "text-right" : ""}`} style={{ width: w, minWidth: w }}
        draggable onDragStart={() => (dragCol.current = col.key)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropCol(col.key)}>
        <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
          <span className="truncate cursor-grab">{col.label}</span>
          {isSorted && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`p-0.5 rounded hover:bg-accent ${activeF || isSorted ? "text-primary" : "text-muted-foreground"}`}>
                <Filter className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => { setSortKey(col.key); setSortDir("asc"); }}><ArrowUp className="h-3.5 w-3.5 mr-2" /> Ordem crescente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortKey(col.key); setSortDir("desc"); }}><ArrowDown className="h-3.5 w-3.5 mr-2" /> Ordem decrescente</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px]">Filtrar</DropdownMenuLabel>
              <div className="p-2 pt-1" onKeyDown={(e) => e.stopPropagation()}>
                {col.options ? (
                  <ColumnFilterOptions options={optionsFor(col.key)} countsFor={() => countsFor(col.key)}
                    value={filters[col.key] ?? ""}
                    onChange={(v) => setFilters({ ...filters, [col.key]: v === "__all__" ? "" : v })} />
                ) : (
                  <Input value={filters[col.key] ?? ""} onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })} className="h-8" placeholder="Contém..." />
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => saveView({ ...view, hidden: [...view.hidden, col.key] })}><EyeOff className="h-3.5 w-3.5 mr-2" /> Ocultar coluna</DropdownMenuItem>
              {(activeF || isSorted) && (
                <DropdownMenuItem onClick={() => {
                  const f = { ...filters }; delete f[col.key]; setFilters(f);
                  if (isSorted) { setSortKey(null); setSortDir(null); }
                }}><X className="h-3.5 w-3.5 mr-2" /> Limpar</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <span onMouseDown={(e) => startResize(e, col.key)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40" />
      </th>
    );
  }

  const hasFilters = busca || Object.values(filters).some(Boolean);
  const displayGroups = new Map<string, any[]>();
  for (const n of pageRows) {
    const key = modoXml === "agrupada" && n.grupo_importacao ? `${n.grupo_importacao}:${recipientGroupKey(n)}` : `nota:${n.id}`;
    displayGroups.set(key, [...(displayGroups.get(key) ?? []), n]);
  }

  return (
    <div>
      <DepositoTabs />
      <PageHeader
        title="Notas Fiscais / Depósito"
        subtitle={`${fmtNum(filtered.length)} de ${fmtNum(notas.length)} notas`}
        actions={
          <>
            {canWrite && (
              <>
                <input ref={indivRef} type="file" accept=".xml" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) importXml(e.target.files, false); e.target.value = ""; }} />
                <input ref={grupRef} type="file" accept=".xml" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) importXml(e.target.files, true); e.target.value = ""; }} />
                <input ref={xlsRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9" disabled={importando}><Upload className="h-4 w-4 mr-1" /> Importar <ChevronDown className="h-3.5 w-3.5 ml-1" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem onClick={() => indivRef.current?.click()}>
                      <div><div className="font-medium">XML individual</div><div className="text-[11px] text-muted-foreground">Uma linha por XML</div></div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => grupRef.current?.click()}>
                      <div><div className="font-medium">XML agrupado</div><div className="text-[11px] text-muted-foreground">Agrupar por destinatário, preservando cada NF</div></div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => xlsRef.current?.click()}>
                      <div><div className="font-medium">Planilha Excel</div><div className="text-[11px] text-muted-foreground">Colunas: Nº NF, Fornecedor, Cliente, Cidade, UF, Peso, Volumes, Valor, Recebimento</div></div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setOpenManual(true)} variant="outline" size="sm" className="h-9"><Plus className="h-4 w-4 mr-1" />Manual</Button>
              </>
            )}
            <Button onClick={exportExcel} variant="outline" size="sm" className="h-9"><FileDown className="h-4 w-4 mr-1" /> Exportar Excel</Button>
            <Button onClick={printTable} variant="outline" size="sm" className="h-9"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
          </>
        }
      />

      {importando && <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 text-sm font-semibold">Importando XMLs, aguarde…</div>}
      <Dialog open={!!resultadoXml} onOpenChange={(o) => !o && setResultadoXml(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Resultado da importação</DialogTitle></DialogHeader>
          {resultadoXml && <div className="space-y-2 text-sm">
            <p><b>{resultadoXml.importadas} nota(s) importada(s)</b></p>
            {resultadoXml.erros.length > 0 ? <><p className="text-destructive">{resultadoXml.erros.length} arquivo(s) rejeitado(s)</p><ul className="list-disc pl-5 max-h-60 overflow-auto">{resultadoXml.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></> : <p className="text-muted-foreground">Nenhum arquivo rejeitado.</p>}
          </div>}
          <Button onClick={() => setResultadoXml(null)}>OK</Button>
        </DialogContent>
      </Dialog>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={modoXml === "individual" ? "default" : "outline"} onClick={() => setModoXml("individual")}>Individual</Button>
        <Button size="sm" variant={modoXml === "agrupada" ? "default" : "outline"} onClick={() => setModoXml("agrupada")}>Agrupada</Button>
        <div className="flex items-center gap-2 border rounded-md px-2 h-9 bg-card flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar em todas as colunas..." className="bg-transparent outline-none text-sm flex-1" />
        </div>
        {canWrite && <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" className="h-9"><ListChecks className="h-4 w-4 mr-1" />AÇÕES{selected.size > 0 ? ` (${selected.size})` : ""}<ChevronDown className="h-3.5 w-3.5 ml-1" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[11px]">{selected.size} nota(s) selecionada(s)</DropdownMenuLabel>
            <DropdownMenuItem disabled={selected.size === 0} onClick={() => { setPrevData(""); setPrevObs(""); setOpenPrev(true); }}><CalendarClock className="h-4 w-4 mr-2" />Definir previsão de entrega</DropdownMenuItem>
            <DropdownMenuItem disabled={selectedNotes.length !== 1 || selectedNotes[0]?.status === "entregue" || !!selectedNotes[0]?.carga_id} onClick={() => setBaixaNota(selectedNotes[0])}><CheckCircle2 className="h-4 w-4 mr-2" />Dar baixa de entrega</DropdownMenuItem>
            <DropdownMenuItem disabled={selected.size === 0} onClick={() => setRotaOpen(true)}><Truck className="h-4 w-4 mr-2" />Adicionar à rota de entrega</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
        <select aria-label="Ordenar" className="h-9 rounded-md border bg-card px-2 text-sm" value={`${sortKey}:${sortDir}`}
          onChange={(e) => { const [k, d] = e.target.value.split(":"); setSortKey(k || null); setSortDir((d as SortDir) || null); }}>
          <option value="previsao_entrega:asc">Previsão mais próxima / maior atraso</option>
          <option value="data_chegada:asc">Recebimento mais antigo</option>
          <option value="data_chegada:desc">Recebimento mais recente</option>
          {!["previsao_entrega:asc", "data_chegada:asc", "data_chegada:desc"].includes(`${sortKey}:${sortDir}`) && <option value={`${sortKey}:${sortDir}`}>Ordenação da coluna</option>}
        </select>
        {hasFilters && <Button size="sm" variant="ghost" className="h-9" onClick={() => { setFilters({}); setBusca(""); }}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-9 ml-auto"><Columns3 className="h-4 w-4 mr-1" />Colunas</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[11px]">Arraste os títulos para reordenar</DropdownMenuLabel>
            {view.order.map((k) => (
              <DropdownMenuCheckboxItem key={k} checked={!view.hidden.includes(k)} onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) => saveView({ ...view, hidden: c ? view.hidden.filter((h) => h !== k) : [...view.hidden, k] })}>
                {COL_MAP[k].label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => saveView(DEFAULT_VIEW)}>Restaurar visualização padrão</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {(["no_prazo", "proximo", "vencido", "sem_previsao"] as Prazo[]).map((k) => (
          <button key={k} type="button" aria-pressed={prazoFiltro === k} onClick={() => setPrazoFiltro(prazoFiltro === k ? null : k)}
            className={`rounded-full border px-2.5 py-0.5 ${prazoFiltro === k ? "ring-2 ring-primary" : ""}`}>
            <span className={PRAZO_CLASS[k]}>{PRAZO_LABEL[k]}</span> <b>{prazoCount[k]}</b>
          </button>))}
        {prazoFiltro && <button type="button" className="underline text-muted-foreground" onClick={() => setPrazoFiltro(null)}>Mostrar todas</button>}
      </div>
      <Dialog open={openPrev} onOpenChange={setOpenPrev}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Definir previsão de entrega ({selected.size})</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="max-h-24 overflow-auto text-muted-foreground">{selectedNotes.map((n: any) => `NF ${n.numero} – ${n.cliente}`).join("; ")}</p>
            {selectedNotes.some((n: any) => n.previsao_entrega) && <p className="rounded border border-warning/50 bg-warning/15 p-2">{selectedNotes.filter((n: any) => n.previsao_entrega).length} nota(s) já têm previsão; a data existente será substituída.</p>}
            <label className="block">Previsão de entrega ao cliente<input type="date" className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={prevData} onChange={(e) => setPrevData(e.target.value)} /></label>
            <label className="block">Observação (opcional)<input className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={prevObs} onChange={(e) => setPrevObs(e.target.value)} /></label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenPrev(false)}>Cancelar</Button>
              <Button disabled={!prevData || salvarPrevisao.isPending} onClick={() => {
                if (selectedNotes.some((n: any) => n.previsao_entrega) && !confirm("Substituir as previsões existentes?")) return;
                salvarPrevisao.mutate(); }}>Salvar previsão</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {rotaOpen && <RotaEntregaDialog notas={selectedNotes} onClose={(ok) => { setRotaOpen(false); if (ok) setSelected(new Set()); }} />}
      {baixaNota && user && <BaixaDiretaDialog nota={baixaNota} open userId={user.id} onClose={() => { setBaixaNota(null); setSelected(new Set()); }} />}
      {canWrite && selected.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
          <span className="font-semibold">{selected.size} selecionada(s)</span>
          <span>Peso <b>{fmtKg(totSel.peso)}</b></span>
          <span>Volumes <b>{fmtNum(totSel.volumes)}</b></span>
          <span>Valor <b>{fmtBRL(totSel.valor)}</b></span>
          <span className="truncate max-w-[320px]" title={cidadesSel.join(", ")}>Cidades <b>{cidadesSel.length}</b>: {cidadesSel.slice(0, 4).join(", ")}{cidadesSel.length > 4 ? "…" : ""}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" className="h-8" disabled={!selectedNotes.every((n: any) => n.status === "disponivel" && !n.carga_id)}
              title="Somente notas disponíveis e sem carga" onClick={() => setOpenCarga(true)}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Adicionar à carga
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setBulkDate(""); setOpenBulkDate(true); }}><CalendarCog className="h-3.5 w-3.5 mr-1" /> Editar data</Button>
            <Button size="sm" variant="destructive" className="h-8" onClick={() => setOpenBulkDelete(true)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5 mr-1" /> Limpar</Button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-md overflow-hidden">
        <div className="max-h-[calc(100vh-280px)] overflow-auto outline-none" tabIndex={0} onKeyDown={onKey}>
          <table className="table-erp" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  {canWrite && filtered.length > 0 && (
                    <input type="checkbox"
                      checked={filtered.every((n: any) => selected.has(n.id))}
                      ref={(el) => {
                        if (el) {
                          const some = filtered.some((n: any) => selected.has(n.id));
                          el.indeterminate = some && !filtered.every((n: any) => selected.has(n.id));
                        }
                      }}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((n: any) => n.id)) : new Set())} />
                  )}
                </th>
                {cols.map((c) => ColHeader({ col: c }))}
              </tr>
            </thead>
            <tbody>
              {Array.from(displayGroups.entries()).map(([key, ns]) => {
                const grouped = ns.length > 1;
                const expanded = expandedGroups.has(key);
                const totals = sum(ns);
                const individualRows = ns.map((n: any) => (
                  <tr key={n.id} aria-selected={selected.has(n.id)} className={occurrenceMap.has(n.id) ? "occurrence-row" : selected.has(n.id) ? "!bg-primary/10" : ""}>
                    <td><input type="checkbox" checked={selected.has(n.id)} disabled={!canWrite} onChange={() => toggle(n.id)} /></td>
                    {cols.map((c) => Cell({ n, col: c }))}
                  </tr>
                ));
                if (!grouped) return individualRows;
                return [<tr key={key} className={ns.some(n=>occurrenceMap.has(n.id))?"occurrence-row":""}>
                  <td><input type="checkbox" aria-label={`Selecionar grupo ${ns[0].cliente}`} disabled={!canWrite} checked={ns.every(n => selected.has(n.id))} onChange={e => { const next = new Set(selected); ns.forEach(n => e.target.checked ? next.add(n.id) : next.delete(n.id)); setSelected(next); }} /></td>
                  <td colSpan={cols.length}>
                    <Button variant="ghost" size="sm" onClick={() => { const next = new Set(expandedGroups); expanded ? next.delete(key) : next.add(key); setExpandedGroups(next); }}>
                      <ChevronDown className={`h-4 w-4 mr-2 ${expanded ? "" : "-rotate-90"}`} />{ns[0].cliente} · {ns.length} NFs · {fmtKg(totals.peso)} · {fmtNum(totals.volumes)} volumes · {fmtBRL(totals.valor)}
                    </Button><OcorrenciaGrupoBadge notas={ns} />
                  </td>
                </tr>, ...(expanded ? individualRows : [])];
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={cols.length + 1} className="text-center text-muted-foreground py-8">Nenhuma nota encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-3 py-2 text-[13px] bg-muted">
          <span>Total {hasFilters ? "filtrado" : ""}: <b>{fmtNum(filtered.length)}</b> notas</span>
          <span>Peso <b>{fmtKg(totFiltro.peso)}</b></span>
          <span>Volumes <b>{fmtNum(totFiltro.volumes)}</b></span>
          <span>Valor <b>{fmtBRL(totFiltro.valor)}</b></span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Button>
            <span>Página {page + 1} de {pages}</span>
            <Button size="sm" variant="outline" className="h-7" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>›</Button>
          </div>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Clique numa célula e use Ctrl+C / Ctrl+V. Duplo clique ou Enter para editar. Nº NF, fornecedor e valor vêm do XML e não são editáveis aqui.</p>

      <ManualDialog open={openManual} onOpenChange={setOpenManual} />
      <GerarCargaDialog open={openCarga}
        onOpenChange={(o) => { setOpenCarga(o); if (!o) setSelected(new Set()); }}
        notaIds={Array.from(selected)} />

      <Dialog open={openBulkDate} onOpenChange={setOpenBulkDate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar data de recebimento ({selected.size})</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label className="text-[11px]">Nova data</Label><Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBulkDate(false)}>Cancelar</Button>
            <Button disabled={!bulkDate || bulkUpdateDate.isPending} onClick={() => bulkUpdateDate.mutate({ ids: Array.from(selected), data: bulkDate })}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openBulkDelete} onOpenChange={setOpenBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} nota(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. As notas selecionadas serão removidas permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDelete.mutate(Array.from(selected))} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


/** Opções de filtro com a quantidade de notas que cada uma devolve; a contagem só roda com o menu aberto. */
function ColumnFilterOptions({ options, countsFor, value, onChange }: {
  options: string[];
  countsFor: () => { total: number; counts: Map<string, number> };
  value: string;
  onChange: (v: string) => void;
}) {
  const { total, counts } = countsFor();
  return (
    <Select value={value || "__all__"} onValueChange={onChange}>
      <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Todos <span className="ml-1 text-muted-foreground tabular-nums">({total})</span></SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            <span className="truncate">{o}</span>
            <span className="ml-1 text-muted-foreground tabular-nums">({counts.get(o) ?? 0})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const [existente, setExistente] = useState("__nova__");
  const { data: cargasAbertas = [] } = useQuery({
    queryKey: ["cargas-abertas"],
    queryFn: async () => (await supabase.from("cargas").select("id,numero,status").eq("situacao", "ativa").in("status", ["separacao", "carregamento"]).order("numero")).data ?? [],
    enabled: open,
  });

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
      let carga: any;
      if (existente !== "__nova__") {
        carga = cargasAbertas.find((c: any) => c.id === existente);
      } else {
        const r = await supabase.from("cargas").insert({
          motorista_id: motorista || null, veiculo_id: veiculo || null,
          data_prevista_saida: data || null, observacoes: obs, status: "separacao",
        }).select().single();
        if (r.error) throw r.error;
        carga = r.data;
      }
      // só vincula notas ainda livres (impede nota em duas cargas ativas)
      const upd = await supabase.from("notas_fiscais").update({
        carga_id: carga.id, status: "separacao",
      }).in("id", notaIds).is("carga_id", null).select("id");
      if (upd.error) throw upd.error;
      if ((upd.data?.length ?? 0) < notaIds.length) toast.warning(`${notaIds.length - (upd.data?.length ?? 0)} nota(s) já estavam em outra carga e foram ignoradas`);
      await supabase.from("historico").insert(notaIds.map((nid) => ({
        entidade: "nota", entidade_id: nid, acao: "vinculo_carga",
        descricao: `Nota vinculada à carga #${carga.numero}`,
      })));
      await supabase.from("historico").insert({
        entidade: "carga", entidade_id: carga.id, acao: "criada",
        descricao: existente !== "__nova__" ? `${notaIds.length} nota(s) adicionada(s) à carga #${carga.numero}` : `Carga #${carga.numero} criada com ${notaIds.length} nota(s)`,
      });
      return carga;
    },
    onSuccess: (c: any) => {
      toast.success(existente !== "__nova__" ? `Notas adicionadas à carga #${c.numero}` : `Carga #${c.numero} criada!`); setExistente("__nova__");
      qc.invalidateQueries();
      onOpenChange(false);
      setMotorista(""); setVeiculo(""); setData(""); setObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar à carga ({notaIds.length} nota(s))</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Carga">
            <Select value={existente} onValueChange={setExistente}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nova__">Nova carga</SelectItem>
                {cargasAbertas.map((c: any) => <SelectItem key={c.id} value={c.id}>Carga #{String(c.numero).padStart(2, "0")} (em aberto)</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {existente === "__nova__" && <>
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
          </>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{existente === "__nova__" ? "Criar carga" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
