import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DepositoTabs } from "@/components/DepositoTabs";
import { FilterTh } from "@/components/ColumnFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Upload, Printer, Receipt, AlertTriangle, History, X } from "lucide-react";
import { fmtBRL, fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { applyColumnFilters, distinctValues, hasActiveFilters, sortRows, type ColFilters, type ColSort } from "@/lib/column-filters";
import { PEDIDO_FIELDS, PEDIDO_STATUS_LABEL, buildPedido, guessMapping, leadTime, splitPasted, type PedidoFieldKey, type PedidoRow } from "@/lib/pedidos-rules";
import { hojeTeresina } from "@/lib/deadline-rules";
import { parseNFeXml, type ParsedNFe } from "@/lib/xml-parser";
import { openReport, tableHtml } from "@/lib/print-report";

export const Route = createFileRoute("/_authenticated/pedidos-rancheiro")({
  head: () => pageHead("Pedidos Rancheiro", "Pedidos disponíveis do Rancheiro, faturamento por XML e envio ao depósito"),
  component: PedidosPage,
});

const FORNECEDOR = "RANCHEIRO";
const d = (v: string | null) => (v ? fmtDate(v + "T12:00") : "");
const STATUS_CLASS: Record<string, string> = { disponivel: "text-info", parcial: "text-warning-foreground", faturado: "text-success", cancelado: "text-destructive" };

function PedidosPage() {
  const { canWrite } = useAuth();
  const hoje = hojeTeresina();
  const [visao, setVisao] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [cf, setCf] = useState<ColFilters>({});
  const [sort, setSort] = useState<ColSort>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [faturar, setFaturar] = useState(false);
  const [detalhe, setDetalhe] = useState<any>(null);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-rancheiro"],
    queryFn: async () => {
      const r = await supabase.from("pedidos_fornecedor")
        .select("*, pedido_notas(nota_id, created_at, registrado_por_nome, notas_fiscais(id, numero, chave_nfe, data_emissao, recebida, status, peso, valor, carga_id))")
        .eq("fornecedor", FORNECEDOR).order("data_tela", { ascending: true, nullsFirst: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const lt = (p: any) => leadTime(p.data_tela, hoje, p.status === "faturado" ? p.data_faturamento : null);
  const get: Record<string, (p: any) => string> = {
    numero: (p) => p.numero_pedido, cliente: (p) => p.cliente, cnpj: (p) => p.cnpj, rota: (p) => p.rota, cidade: (p) => p.cidade,
    tela: (p) => d(p.data_tela), lead: (p) => { const l = lt(p); return l.futura ? "Data futura" : l.dias === null ? "Não definido" : `${l.dias} dia(s)`; },
    fat: (p) => d(p.data_faturamento), peso: (p) => fmtNum(p.peso, 3), valor: (p) => fmtBRL(p.valor), m3: (p) => fmtNum(p.m3, 3),
    status: (p) => PEDIDO_STATUS_LABEL[p.status] ?? p.status,
  };
  const numeric: Record<string, (p: any) => number> = {
    peso: (p) => Number(p.peso), valor: (p) => Number(p.valor), m3: (p) => Number(p.m3), lead: (p) => lt(p).dias ?? -1,
    tela: (p) => Date.parse(p.data_tela ?? "9999-12-31"), fat: (p) => Date.parse(p.data_faturamento ?? "9999-12-31"),
  };
  const base = useMemo(() => pedidos.filter((p: any) => (visao === "todos" || (visao === "abertos" ? ["disponivel", "parcial"].includes(p.status) : p.status === visao))
    && (!busca.trim() || Object.values(get).some((g) => g(p).toLowerCase().includes(busca.trim().toLowerCase())))), [pedidos, visao, busca]);
  const rows = useMemo(() => sortRows(applyColumnFilters(base, cf, get), sort, get, numeric), [base, cf, sort]);
  const selRows = rows.filter((p: any) => sel.has(p.id));
  const tot = (ps: any[]) => ps.reduce((a, p) => ({ n: a.n + 1, peso: a.peso + Number(p.peso), valor: a.valor + Number(p.valor), m3: a.m3 + Number(p.m3) }), { n: 0, peso: 0, valor: 0, m3: 0 });
  const t = tot(rows); const ts = tot(selRows);
  const aptos = selRows.filter((p: any) => ["disponivel", "parcial"].includes(p.status));
  const pendentesFisicos = pedidos.flatMap((p: any) => (p.pedido_notas ?? []).map((v: any) => v.notas_fiscais)).filter((n: any) => n && !n.recebida);
  const pendUnicas = [...new Map(pendentesFisicos.map((n: any) => [n.id, n])).values()];

  const th = (k: string, label: string, cls = "") => <FilterTh label={label} colKey={k} className={cls} values={distinctValues(base, get[k]!)} filters={cf} setFilters={setCf} sort={sort} setSort={setSort} />;

  function imprimir() {
    const list = selRows.length ? selRows : rows;
    const filtros = [busca && `Busca: ${busca}`, `Situação: ${visao}`, ...Object.entries(cf).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(", ")}`), selRows.length ? `${selRows.length} selecionado(s)` : ""].filter(Boolean).join(" | ");
    const tt = tot(list);
    const ok = openReport("Relatório de Pedidos Rancheiro", [`Filtros: ${filtros || "Nenhum"}`, `Pedidos: ${tt.n} | Peso: ${fmtNum(tt.peso, 3)} | Valor: ${fmtBRL(tt.valor)} | M³: ${fmtNum(tt.m3, 3)}`],
      tableHtml(["Pedido", "Cliente", "CNPJ", "Rota", "Cidade", "Data na tela", "Lead time", "Faturamento", "Peso", "Valor", "M³", "Status"],
        list.map((p: any) => Object.keys(get).map((k) => get[k]!(p))), [8, 9, 10]));
    if (!ok) toast.error("Permita pop-ups para imprimir");
  }

  return (
    <div>
      <DepositoTabs />
      <PageHeader title="Pedidos Rancheiro" subtitle={`${fmtNum(rows.length)} pedido(s) • faturamento comercial do fornecedor (não é entrega nem frete)`}
        actions={<>
          {canWrite && <><Button size="sm" variant="outline" className="h-9" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />IMPORTAR PEDIDOS</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setForm({})}><Plus className="h-4 w-4 mr-1" />Pedido manual</Button></>}
          <Button size="sm" variant="outline" className="h-9" onClick={imprimir}><Printer className="h-4 w-4 mr-1" />IMPRIMIR</Button>
          {canWrite && <Button size="sm" className="h-9" disabled={!aptos.length} onClick={() => setFaturar(true)}><Receipt className="h-4 w-4 mr-1" />FATURAR PEDIDOS{aptos.length ? ` (${aptos.length})` : ""}</Button>}
        </>} />
      {pendUnicas.length > 0 && <div className="mb-2 rounded-md border border-warning/50 bg-warning/15 p-2 text-sm flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" />{pendUnicas.length} NF faturada(s) aguardando disponibilidade física — não entram no Depósito até a confirmação.
        {canWrite && <LiberarFisico notas={pendUnicas} />}
      </div>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[["abertos", "Disponíveis / parciais"], ["faturado", "Faturados"], ["cancelado", "Cancelados"], ["todos", "Todos"]].map(([k, l]) =>
          <Button key={k} size="sm" className="h-8" variant={visao === k ? "default" : "outline"} onClick={() => { setVisao(k!); setSel(new Set()); }}>{l}</Button>)}
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar..." className="h-8 max-w-xs" />
        {(hasActiveFilters(cf) || sort || busca) && <Button size="sm" variant="ghost" className="h-8" onClick={() => { setCf({}); setSort(null); setBusca(""); }}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}
      </div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs rounded-md border bg-card px-3 py-1.5">
        <span>Pedidos: <b>{t.n}</b></span><span>Peso: <b>{fmtNum(t.peso, 3)}</b></span><span>Valor: <b>{fmtBRL(t.valor)}</b></span><span>M³: <b>{fmtNum(t.m3, 3)}</b></span>
        {selRows.length > 0 && <span className="text-primary">Selecionados: <b>{ts.n}</b> • {fmtNum(ts.peso, 3)} • {fmtBRL(ts.valor)} • {fmtNum(ts.m3, 3)} m³</span>}
      </div>
      <div className="bg-card border rounded-md max-h-[calc(100vh-300px)] overflow-auto">
        <table className="table-erp">
          <thead><tr>
            <th className="w-8"><Checkbox aria-label="Selecionar todos filtrados" checked={rows.length > 0 && rows.every((p: any) => sel.has(p.id))} onCheckedChange={(c) => setSel(c === true ? new Set(rows.map((p: any) => p.id)) : new Set())} /></th>
            {th("numero", "Nº pedido")}{th("cliente", "Cliente")}{th("cnpj", "CNPJ")}{th("rota", "Rota")}{th("cidade", "Cidade")}{th("tela", "Data na tela")}
            {th("lead", "Lead time")}{th("fat", "Data faturamento")}{th("peso", "Peso", "text-right")}{th("valor", "Valor do pedido", "text-right")}{th("m3", "M³", "text-right")}{th("status", "Status")}<th />
          </tr></thead>
          <tbody>
            {rows.map((p: any) => { const l = lt(p); return (
              <tr key={p.id} className={sel.has(p.id) ? "bg-accent/40" : ""}>
                <td><Checkbox aria-label={`Selecionar pedido ${p.numero_pedido}`} checked={sel.has(p.id)} onCheckedChange={(c) => { const s = new Set(sel); if (c === true) s.add(p.id); else s.delete(p.id); setSel(s); }} /></td>
                <td className="font-mono font-semibold">{p.numero_pedido}</td><td>{p.cliente || "—"}</td><td className="font-mono">{p.cnpj || "—"}</td><td>{p.rota || "—"}</td><td>{p.cidade || "—"}</td>
                <td>{d(p.data_tela) || "—"}</td>
                <td className={l.futura ? "text-destructive" : ""}>{l.futura ? <span title="Data na tela posterior a hoje"><AlertTriangle className="inline h-3 w-3 mr-1" />Data futura</span> : l.dias === null ? "Não definido" : `${l.dias} dia(s)`}</td>
                <td>{d(p.data_faturamento) || "—"}</td>
                <td className="text-right">{fmtNum(p.peso, 3)}</td><td className="text-right">{fmtBRL(p.valor)}</td><td className="text-right">{fmtNum(p.m3, 3)}</td>
                <td className={STATUS_CLASS[p.status]}>{PEDIDO_STATUS_LABEL[p.status]}{p.status_fornecedor ? <span className="text-muted-foreground"> • {p.status_fornecedor}</span> : null}</td>
                <td className="whitespace-nowrap">
                  {canWrite && <Button size="sm" variant="ghost" className="h-7" onClick={() => setForm(p)}>Editar</Button>}
                  <Button size="sm" variant="ghost" className="h-7" aria-label="Detalhes e histórico" onClick={() => setDetalhe(p)}><History className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>); })}
            {!rows.length && <tr><td colSpan={14} className="text-center text-muted-foreground py-8">Nenhum pedido. Use IMPORTAR PEDIDOS ou Pedido manual.</td></tr>}
          </tbody>
        </table>
      </div>
      {importOpen && <ImportDialog existentes={pedidos} onClose={() => setImportOpen(false)} />}
      {form && <PedidoForm pedido={form} onClose={() => setForm(null)} />}
      {faturar && <FaturarDialog pedidos={aptos} onClose={(ok) => { setFaturar(false); if (ok) setSel(new Set()); }} />}
      {detalhe && <DetalhePedido pedido={pedidos.find((p: any) => p.id === detalhe.id) ?? detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

function LiberarFisico({ notas }: { notas: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(hojeTeresina());
  const [ids, setIds] = useState<Set<string>>(new Set(notas.map((n) => n.id)));
  const mut = useMutation({
    mutationFn: async () => { const r = await supabase.rpc("liberar_notas_pedido", { _notas: [...ids], _data: data }); if (r.error) throw r.error; return r.data; },
    onSuccess: (c) => { toast.success(`${c} nota(s) liberada(s) no Depósito`); qc.invalidateQueries(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return <>
    <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>Confirmar disponibilidade física</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Mercadoria disponível fisicamente</DialogTitle></DialogHeader>
      <div className="space-y-1 max-h-48 overflow-auto text-sm">{notas.map((n) => <label key={n.id} className="flex gap-2 items-center"><Checkbox checked={ids.has(n.id)} onCheckedChange={(c) => { const s = new Set(ids); if (c === true) s.add(n.id); else s.delete(n.id); setIds(s); }} />NF {n.numero}</label>)}</div>
      <Label>Data efetiva de disponibilidade</Label><Input type="date" value={data} max={hojeTeresina()} onChange={(e) => setData(e.target.value)} />
      <DialogFooter><Button disabled={!ids.size || !data || mut.isPending} onClick={() => mut.mutate()}>Liberar no Depósito</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

function ImportDialog({ existentes, onClose }: { existentes: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [matrix, setMatrix] = useState<unknown[][] | null>(null);
  const [map, setMap] = useState<Partial<Record<PedidoFieldKey, number>>>({});
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = (m: unknown[][]) => { const clean = m.filter((r) => r.some((c) => String(c ?? "").trim())); setMatrix(clean); setMap(guessMapping((clean[0] ?? []).map(String))); };
  async function readFile(f: File) {
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true, raw: false, type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    load(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy" }));
  }
  const headers = (matrix?.[0] ?? []).map(String);
  const parsed = useMemo(() => (matrix ?? []).slice(1).map((r, i) => ({ linha: i + 2, ...buildPedido(r, map) })), [matrix, map]);
  const byNum = new Map(existentes.map((p) => [p.numero_pedido, p]));
  const dupInFile = new Set<string>(); const seen = new Set<string>();
  for (const p of parsed) { if (seen.has(p.row.numero_pedido)) dupInFile.add(p.row.numero_pedido); seen.add(p.row.numero_pedido); }
  const validos = parsed.filter((p) => !p.erros.length && !dupInFile.has(p.row.numero_pedido));
  const novos = validos.filter((p) => !byNum.has(p.row.numero_pedido));
  const atualiza = validos.filter((p) => byNum.has(p.row.numero_pedido));
  const invalidos = parsed.filter((p) => p.erros.length || dupInFile.has(p.row.numero_pedido));

  async function confirmar() {
    setBusy(true);
    try {
      const payload = (r: PedidoRow) => { const o: any = { fornecedor: FORNECEDOR, numero_pedido: r.numero_pedido };
        for (const f of PEDIDO_FIELDS) if (map[f.key] !== undefined && f.key !== "numero_pedido") o[f.key] = (r as any)[f.key]; return o; };
      const all = validos.map((p) => payload(p.row));
      for (let i = 0; i < all.length; i += 500) {
        const r = await supabase.from("pedidos_fornecedor").upsert(all.slice(i, i + 500), { onConflict: "fornecedor,numero_pedido" });
        if (r.error) throw r.error;
      }
      toast.success(`${novos.length} pedido(s) adicionado(s), ${atualiza.length} atualizado(s)${invalidos.length ? `, ${invalidos.length} linha(s) com erro não importada(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["pedidos-rancheiro"] }); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-5xl max-h-[92vh] overflow-auto">
    <DialogHeader><DialogTitle>Importar pedidos Rancheiro</DialogTitle></DialogHeader>
    {!matrix ? <div className="space-y-3 text-sm">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
      <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Escolher planilha Excel ou CSV</Button>
      <div><Label>Ou cole várias linhas copiadas da planilha (com a linha de títulos)</Label>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} className="w-full rounded-md border bg-background p-2 font-mono text-xs" placeholder={"Pedido\tCliente\tCNPJ\tRota\tCidade\tData\tPeso\tValor\tM3"} /></div>
      <Button disabled={!paste.trim()} onClick={() => load(splitPasted(paste))}>Ler linhas coladas</Button>
    </div> : <div className="space-y-3 text-sm">
      <div className="font-semibold">Relacione as colunas da planilha com os campos do sistema</div>
      <div className="grid sm:grid-cols-3 gap-2">{PEDIDO_FIELDS.map((f) => <label key={f.key} className="text-xs">{f.label}
        <select className="mt-0.5 h-8 w-full rounded border bg-background px-1" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
          <option value="">— não importar —</option>{headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}</select></label>)}</div>
      <div className="flex flex-wrap gap-3"><b className="text-success">{novos.length} novo(s)</b><b className="text-info">{atualiza.length} a atualizar</b><b className="text-destructive">{invalidos.length} com problema</b></div>
      {invalidos.length > 0 && <ul className="text-destructive text-xs max-h-28 overflow-auto list-disc pl-5">{invalidos.map((p) => <li key={p.linha}>Linha {p.linha}: {[...p.erros, dupInFile.has(p.row.numero_pedido) ? "pedido repetido na planilha" : ""].filter(Boolean).join("; ")}</li>)}</ul>}
      <div className="overflow-auto max-h-72 border rounded"><table className="table-erp"><thead><tr><th>Linha</th><th>Ação</th>{PEDIDO_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
        <tbody>{parsed.slice(0, 200).map((p) => <tr key={p.linha} className={p.erros.length ? "text-destructive" : ""}><td>{p.linha}</td><td>{p.erros.length || dupInFile.has(p.row.numero_pedido) ? "Corrigir" : byNum.has(p.row.numero_pedido) ? "Atualizar" : "Adicionar"}</td>
          {PEDIDO_FIELDS.map((f) => <td key={f.key}>{String((p.row as any)[f.key] ?? "")}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Pedidos que não estão na planilha continuam cadastrados. Pedidos já faturados mantêm o faturamento e as notas vinculadas.</p>
      <DialogFooter><Button variant="outline" onClick={() => setMatrix(null)}>Voltar</Button><Button disabled={busy || map.numero_pedido === undefined || !validos.length} onClick={confirmar}>Confirmar importação ({validos.length})</Button></DialogFooter>
    </div>}
  </DialogContent></Dialog>;
}

function PedidoForm({ pedido, onClose }: { pedido: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({ numero_pedido: "", cliente: "", cnpj: "", rota: "", cidade: "", data_tela: "", data_faturamento: "", peso: 0, valor: 0, m3: 0, status_fornecedor: "", observacoes: "", status: "disponivel", ...pedido });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const mut = useMutation({
    mutationFn: async () => {
      const o = { cliente: f.cliente, cnpj: f.cnpj, rota: f.rota, cidade: f.cidade, data_tela: f.data_tela || null, data_faturamento: f.data_faturamento || null,
        peso: Number(f.peso) || 0, valor: Number(f.valor) || 0, m3: Number(f.m3) || 0, status_fornecedor: f.status_fornecedor, observacoes: f.observacoes ?? "", status: f.status };
      const r = pedido.id ? await supabase.from("pedidos_fornecedor").update(o).eq("id", pedido.id)
        : await supabase.from("pedidos_fornecedor").insert({ ...o, fornecedor: FORNECEDOR, numero_pedido: f.numero_pedido });
      if (r.error) throw r.error.code === "23505" ? new Error("Já existe um pedido com esse número") : r.error;
    },
    onSuccess: () => { toast.success("Pedido salvo"); qc.invalidateQueries({ queryKey: ["pedidos-rancheiro"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  const billed = ["faturado", "parcial"].includes(pedido.status);
  const inp = (k: string, label: string, type = "text") => <div><Label className="text-[11px]">{label}</Label><Input type={type} step="any" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} disabled={k === "numero_pedido" && !!pedido.id} /></div>;
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl">
    <DialogHeader><DialogTitle>{pedido.id ? `Pedido ${pedido.numero_pedido}` : "Novo pedido Rancheiro"}</DialogTitle></DialogHeader>
    <div className="grid sm:grid-cols-3 gap-2">
      {inp("numero_pedido", "Número do pedido")}{inp("cliente", "Cliente")}{inp("cnpj", "CNPJ")}{inp("rota", "Rota")}{inp("cidade", "Cidade")}{inp("data_tela", "Data na tela", "date")}
      {inp("data_faturamento", "Data de faturamento", "date")}{inp("peso", "Peso", "number")}{inp("valor", "Valor do pedido (R$)", "number")}{inp("m3", "M³", "number")}{inp("status_fornecedor", "Status informado pelo fornecedor")}
      <div><Label className="text-[11px]">Situação</Label><select disabled={billed} className="h-10 w-full rounded-md border bg-background px-2" value={f.status} onChange={(e) => set("status", e.target.value)}>
        {billed ? <option value={f.status}>{PEDIDO_STATUS_LABEL[f.status]}</option> : <><option value="disponivel">Disponível</option><option value="cancelado">Cancelado</option></>}</select></div>
    </div>
    {inp("observacoes", "Observações")}
    {f.status === "cancelado" && pedido.status !== "cancelado" && <p className="text-xs text-destructive">Cancele somente quando o fornecedor confirmar.</p>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!f.numero_pedido?.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button></DialogFooter>
  </DialogContent></Dialog>;
}

type XmlNota = ParsedNFe & { arquivo: string; pedidosRef: string[]; existente?: any };
function pedidoRefs(xml: string): string[] {
  const refs = new Set<string>();
  for (const m of xml.matchAll(/<(?:\w+:)?xPed>([^<]+)</g)) refs.add(m[1]!.trim());
  for (const m of xml.matchAll(/PEDIDO[S]?\s*(?:N[º°o.]*)?\s*[:\-]?\s*([0-9][0-9/\- ]{2,})/gi)) for (const p of m[1]!.split(/[\/\- ]+/)) if (p.length >= 3) refs.add(p.trim());
  return [...refs];
}
const digits = (s: string) => (s ?? "").replace(/\D/g, "");

function FaturarDialog({ pedidos, onClose }: { pedidos: any[]; onClose: (ok: boolean) => void }) {
  const qc = useQueryClient();
  const [notas, setNotas] = useState<XmlNota[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [links, setLinks] = useState<Record<string, Set<string>>>({});
  const [completos, setCompletos] = useState<Set<string>>(new Set(pedidos.map((p) => p.id)));
  const [fisico, setFisico] = useState(true);
  const [dataFisica, setDataFisica] = useState(hojeTeresina());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tp = pedidos.reduce((a, p) => ({ peso: a.peso + Number(p.peso), valor: a.valor + Number(p.valor) }), { peso: 0, valor: 0 });

  async function anexar(files: FileList) {
    const novas: XmlNota[] = []; const errs: string[] = [];
    for (const f of Array.from(files)) {
      const txt = await f.text();
      const p = parseNFeXml(txt);
      if ("error" in p) { errs.push(`${f.name}: ${p.error}`); continue; }
      if (notas.some((n) => n.chave_nfe === p.chave_nfe) || novas.some((n) => n.chave_nfe === p.chave_nfe)) { errs.push(`${f.name}: XML repetido nesta seleção`); continue; }
      novas.push({ ...p, arquivo: f.name, pedidosRef: pedidoRefs(txt) });
    }
    if (novas.length) {
      const r = await supabase.from("notas_fiscais").select("id,numero,chave_nfe,status,recebida,carga_id").in("chave_nfe", novas.map((n) => n.chave_nfe));
      for (const n of novas) n.existente = r.data?.find((e) => e.chave_nfe === n.chave_nfe);
    }
    const l = { ...links };
    for (const n of novas) {
      const auto = pedidos.filter((p) => n.pedidosRef.some((r) => r.replace(/^0+/, "") === String(p.numero_pedido).replace(/^0+/, ""))).map((p) => p.id);
      l[n.chave_nfe] = new Set(auto.length ? auto : pedidos.length === 1 ? [pedidos[0].id] : []);
    }
    setLinks(l); setNotas([...notas, ...novas]); setErros([...erros, ...errs]);
  }
  const toggle = (chave: string, pid: string, on: boolean) => { const s = new Set(links[chave] ?? []); if (on) s.add(pid); else s.delete(pid); setLinks({ ...links, [chave]: s }); };
  const alertas = (n: XmlNota) => {
    const a: string[] = [];
    if (!/rancheiro/i.test(n.fornecedor)) a.push(`Emitente "${n.fornecedor}" não parece ser o Rancheiro`);
    const ps = pedidos.filter((p) => links[n.chave_nfe]?.has(p.id));
    if (ps.some((p) => digits(p.cnpj) && digits(p.cnpj) !== digits(n.cnpj_destinatario))) a.push("CNPJ do destinatário diferente do pedido");
    if (ps.some((p) => p.cidade && p.cidade.toLowerCase() !== n.cidade.toLowerCase())) a.push("Cidade diferente do pedido");
    const vp = ps.reduce((s, p) => s + Number(p.valor), 0);
    if (ps.length && vp > 0 && Math.abs(vp - n.valor) / vp > 0.05) a.push(`Valor da NF ${fmtBRL(n.valor)} difere dos pedidos ${fmtBRL(vp)}`);
    if (n.existente) a.push(`NF já cadastrada (${n.existente.status}${n.existente.recebida ? "" : ", aguardando recebimento"}) — será apenas vinculada, sem duplicar`);
    if (!n.itens_xml.length) a.push("XML sem produtos");
    return a;
  };
  const semVinculo = notas.filter((n) => !(links[n.chave_nfe]?.size));
  const vinculados = new Set(Object.values(links).flatMap((s) => [...s]));
  const completosSemNota = [...completos].filter((id) => !vinculados.has(id));

  async function confirmar() {
    setBusy(true);
    try {
      const novas = notas.filter((n) => !n.existente).map(({ arquivo: _a, pedidosRef: _p, existente: _e, ...n }) => n);
      const vinc = notas.flatMap((n) => [...(links[n.chave_nfe] ?? [])].map((pid) => ({ pedido: pid, chave: n.chave_nfe })));
      const r = await supabase.rpc("faturar_pedidos", { _notas: novas as any, _vinculos: vinc as any, _completos: [...completos].filter((id) => vinculados.has(id)), _disponivel: fisico, _data_fisica: (fisico ? dataFisica : null) as any });
      if (r.error) throw r.error;
      const x = r.data as any;
      toast.success(`Faturamento registrado: ${x.pedidos} pedido(s), ${x.criadas} NF nova(s)${x.existentes ? `, ${x.existentes} já existente(s) vinculada(s)` : ""}${fisico ? " — notas no Depósito" : " — aguardando disponibilidade física"}`);
      qc.invalidateQueries(); onClose(true);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(o) => !o && !busy && onClose(false)}><DialogContent className="max-w-5xl max-h-[92vh] overflow-auto" onInteractOutside={(e) => e.preventDefault()}>
    <DialogHeader><DialogTitle>Faturar pedidos ({pedidos.length})</DialogTitle></DialogHeader>
    <div className="text-sm space-y-3">
      <div className="overflow-auto max-h-40 border rounded"><table className="table-erp"><thead><tr><th>Pedido</th><th>Cliente</th><th>CNPJ</th><th>Cidade</th><th className="text-right">Peso</th><th className="text-right">Valor</th><th>Faturamento completo?</th></tr></thead>
        <tbody>{pedidos.map((p) => <tr key={p.id}><td className="font-mono">{p.numero_pedido}</td><td>{p.cliente}</td><td>{p.cnpj}</td><td>{p.cidade}</td><td className="text-right">{fmtNum(p.peso, 3)}</td><td className="text-right">{fmtBRL(p.valor)}</td>
          <td><label className="flex items-center gap-1"><Checkbox checked={completos.has(p.id)} onCheckedChange={(c) => { const s = new Set(completos); if (c === true) s.add(p.id); else s.delete(p.id); setCompletos(s); }} />{completos.has(p.id) ? "Completo" : "Parcial"}</label></td></tr>)}</tbody></table></div>
      <p>Total selecionado: <b>{fmtNum(tp.peso, 3)}</b> • <b>{fmtBRL(tp.valor)}</b></p>
      <input ref={fileRef} type="file" accept=".xml" multiple className="hidden" onChange={(e) => { if (e.target.files) anexar(e.target.files); e.target.value = ""; }} />
      <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />ANEXAR XML DAS NOTAS FISCAIS</Button>
      {erros.length > 0 && <ul className="text-destructive text-xs list-disc pl-5">{erros.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {notas.map((n) => { const a = alertas(n); return <div key={n.chave_nfe} className="border rounded-md p-2">
        <div className="flex flex-wrap justify-between gap-2"><b>NF {n.numero} • {n.cliente} • {n.cidade}/{n.uf}</b>
          <Button size="sm" variant="ghost" className="h-6" onClick={() => setNotas(notas.filter((x) => x.chave_nfe !== n.chave_nfe))}><X className="h-3 w-3" /></Button></div>
        <div className="text-xs text-muted-foreground">Chave {n.chave_nfe} • Emitente {n.fornecedor} • Emissão {d(n.data_emissao)} • {fmtNum(n.peso, 3)} kg • {n.volumes} vol • {fmtBRL(n.valor)} • {n.itens_xml.length} produto(s){n.pedidosRef.length ? ` • Pedido no XML: ${n.pedidosRef.join(", ")}` : " • sem número de pedido no XML"}</div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs"><span className="font-semibold">Vincular aos pedidos:</span>{pedidos.map((p) => <label key={p.id} className="flex items-center gap-1"><Checkbox checked={links[n.chave_nfe]?.has(p.id) ?? false} onCheckedChange={(c) => toggle(n.chave_nfe, p.id, c === true)} />{p.numero_pedido}{digits(p.cnpj) && digits(p.cnpj) === digits(n.cnpj_destinatario) ? " (mesmo CNPJ)" : ""}</label>)}</div>
        {a.length > 0 && <ul className="mt-1 text-xs text-warning-foreground bg-warning/15 rounded p-1 list-disc pl-5">{a.map((x) => <li key={x}>{x}</li>)}</ul>}
      </div>; })}
      <div className="border rounded-md p-2 space-y-2">
        <label className="flex items-center gap-2"><Checkbox checked={fisico} onCheckedChange={(c) => setFisico(c === true)} />As mercadorias estão disponíveis fisicamente na Transmerida</label>
        {fisico ? <div className="flex items-center gap-2"><Label>Data efetiva</Label><Input type="date" className="w-44" value={dataFisica} max={hojeTeresina()} onChange={(e) => setDataFisica(e.target.value)} /></div>
          : <p className="text-xs text-muted-foreground">O faturamento fica registrado e as notas aguardam a confirmação física antes de aparecer no Depósito.</p>}
      </div>
      {semVinculo.length > 0 && <p className="text-destructive text-xs">{semVinculo.length} NF sem pedido vinculado — vincule ou remova antes de confirmar.</p>}
      {completosSemNota.length > 0 && notas.length > 0 && <p className="text-xs text-muted-foreground">{completosSemNota.length} pedido(s) sem nota neste envio permanecerão sem alteração.</p>}
    </div>
    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancelar</Button>
      <Button disabled={busy || !notas.length || semVinculo.length > 0 || (fisico && !dataFisica)} onClick={confirmar}>{busy ? "Registrando…" : "CONFIRMAR FATURAMENTO"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function DetalhePedido({ pedido, onClose }: { pedido: any; onClose: () => void }) {
  const { data: hist = [] } = useQuery({
    queryKey: ["pedido-historico", pedido.id],
    queryFn: async () => (await supabase.from("historico").select("id,descricao,created_at,acao").eq("entidade_id", pedido.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const l = leadTime(pedido.data_tela, hojeTeresina(), pedido.data_faturamento);
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
    <DialogHeader><DialogTitle>Pedido {pedido.numero_pedido} — {PEDIDO_STATUS_LABEL[pedido.status]}</DialogTitle></DialogHeader>
    <div className="text-sm grid sm:grid-cols-2 gap-1">
      <div>Cliente: <b>{pedido.cliente || "—"}</b> ({pedido.cnpj || "sem CNPJ"})</div><div>Rota / cidade: {pedido.rota || "—"} / {pedido.cidade || "—"}</div>
      <div>Data na tela: {d(pedido.data_tela) || "—"}</div><div>Faturamento: {d(pedido.data_faturamento) || "—"}{pedido.data_faturamento && l.dias !== null ? ` (lead time ${l.dias} dia(s))` : ""}</div>
      <div>Peso {fmtNum(pedido.peso, 3)} • {fmtBRL(pedido.valor)} • {fmtNum(pedido.m3, 3)} m³</div><div>Status do fornecedor: {pedido.status_fornecedor || "—"}</div>
      {pedido.faturado_em && <div className="sm:col-span-2">Registrado por {pedido.faturado_por_nome} em {fmtDateTime(pedido.faturado_em)}</div>}
    </div>
    <h3 className="font-semibold mt-2">Notas fiscais vinculadas</h3>
    <table className="table-erp"><thead><tr><th>NF</th><th>Chave</th><th>Emissão</th><th>Situação</th><th className="text-right">Peso</th><th className="text-right">Valor</th><th>Vinculado por</th></tr></thead><tbody>
      {(pedido.pedido_notas ?? []).map((v: any) => <tr key={v.nota_id}><td>{v.notas_fiscais?.numero}</td><td className="font-mono text-[10px]">{v.notas_fiscais?.chave_nfe}</td><td>{d(v.notas_fiscais?.data_emissao)}</td>
        <td>{v.notas_fiscais?.recebida ? v.notas_fiscais?.status : "Aguardando disponibilidade física"}</td><td className="text-right">{fmtNum(v.notas_fiscais?.peso, 3)}</td><td className="text-right">{fmtBRL(v.notas_fiscais?.valor)}</td><td>{v.registrado_por_nome} • {fmtDateTime(v.created_at)}</td></tr>)}
      {!(pedido.pedido_notas ?? []).length && <tr><td colSpan={7} className="text-muted-foreground">Nenhuma nota vinculada.</td></tr>}
    </tbody></table>
    <h3 className="font-semibold mt-2">Histórico</h3>
    <div className="text-xs divide-y border rounded max-h-60 overflow-auto">{hist.map((h: any) => <div key={h.id} className="p-1.5">{h.descricao}<div className="text-muted-foreground">{fmtDateTime(h.created_at)}</div></div>)}
      {!hist.length && <div className="p-2 text-muted-foreground">Sem alterações registradas.</div>}</div>
  </DialogContent></Dialog>;
}
