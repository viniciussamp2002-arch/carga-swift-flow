import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DepositoTabs } from "@/components/DepositoTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ENTRADA_STATUS_LABEL } from "@/lib/agenda";
import { fmtBRL, fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import { lerXmls } from "@/lib/nfe-import";
import { recipientGroupKey } from "@/lib/nfe-rules";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Upload, CheckCircle2, Trash2, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { OcorrenciaBadge, RegistrarOcorrencia } from "@/components/Ocorrencias";

export const Route = createFileRoute("/_authenticated/cargas-previstas")({
  head: () => pageHead("Cargas de Entrada", "Transportes vindos dos fornecedores, antes do recebimento"),
  component: CargasEntradaPage,
});

const STATUS_COLOR: Record<string, string> = {
  prevista: "bg-muted text-foreground border-border",
  em_transito: "bg-info/15 text-info border-info/30",
  recebida_parcial: "bg-warning/15 text-warning-foreground border-warning/40",
  recebida: "bg-success/15 text-success border-success/30",
  cancelada: "bg-destructive/10 text-destructive border-destructive/30",
};
const EMPTY = { numero_transporte: "", transportadora: "", fornecedor: "", motorista: "", placa: "", data_carregamento: "", previsao_chegada: "", status: "prevista", observacoes: "" };

const sum = (ns: any[]) => ns.reduce((a, n) => ({ notas: a.notas + 1, peso: a.peso + Number(n.peso ?? 0), volumes: a.volumes + Number(n.volumes ?? 0), valor: a.valor + Number(n.valor ?? 0) }), { notas: 0, peso: 0, volumes: 0, valor: 0 });

function CargasEntradaPage() {
  const { canWrite } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusF, setStatusF] = useState("__all__");
  const qc = useQueryClient();

  const { data: cargas = [] } = useQuery({
    queryKey: ["cargas-entrada"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cargas_entrada")
        .select("*, notas_fiscais(peso, volumes, valor, recebida)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = statusF === "__all__" ? cargas : cargas.filter((c: any) => c.status === statusF);

  const salvar = useMutation({
    mutationFn: async (f: any) => {
      const payload = { ...f, data_carregamento: f.data_carregamento || null, previsao_chegada: f.previsao_chegada || null };
      delete payload.id;
      const r = f.id ? await supabase.from("cargas_entrada").update(payload).eq("id", f.id)
        : await supabase.from("cargas_entrada").insert(payload);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Carga salva"); setForm(null); qc.invalidateQueries({ queryKey: ["cargas-entrada"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <DepositoTabs />
      <PageHeader title="Cargas de Entrada" subtitle="Transportes vindos dos fornecedores — notas só entram no depósito após confirmar a chegada"
        actions={<>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__all__">Todos os status</SelectItem>
              {Object.entries(ENTRADA_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          {canWrite && <Button size="sm" className="h-9" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" />Nova carga de entrada</Button>}
        </>} />
      <div className="bg-card border rounded-md overflow-auto">
        <table className="table-erp">
          <thead><tr>
            <th>Transporte</th><th>Transportadora</th><th>Fornecedor</th><th>Motorista / Placa</th><th>Carregamento</th>
            <th>Previsão</th><th>Chegada</th><th className="text-right">Notas</th><th className="text-right">Peso (kg)</th>
            <th className="text-right">Volumes</th><th className="text-right">Valor</th><th>Status</th>
          </tr></thead>
          <tbody>
            {rows.map((c: any) => { const t = sum(c.notas_fiscais ?? []); return (
              <tr key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                <td className="font-semibold">{c.numero_transporte || "—"}</td><td>{c.transportadora || "—"}</td><td>{c.fornecedor || "—"}</td>
                <td>{[c.motorista, c.placa].filter(Boolean).join(" • ") || "—"}</td>
                <td>{fmtDate(c.data_carregamento && c.data_carregamento + "T12:00")}</td><td>{fmtDate(c.previsao_chegada && c.previsao_chegada + "T12:00")}</td>
                <td>{fmtDateTime(c.data_chegada)}</td>
                <td className="text-right">{t.notas}</td><td className="text-right">{fmtNum(t.peso, 3)}</td><td className="text-right">{fmtNum(t.volumes)}</td>
                <td className="text-right">{fmtBRL(t.valor)}</td>
                <td><StatusBadge className={STATUS_COLOR[c.status]}>{ENTRADA_STATUS_LABEL[c.status]}</StatusBadge></td>
              </tr>); })}
            {rows.length === 0 && <tr><td colSpan={12} className="text-center text-muted-foreground py-8">Nenhuma carga de entrada cadastrada</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form?.id ? "Editar carga de entrada" : "Nova carga de entrada"}</DialogTitle></DialogHeader>
          {form && <CargaForm form={form} setForm={setForm} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={salvar.isPending} onClick={() => salvar.mutate(form)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {openId && <DetalheCarga id={openId} onClose={() => setOpenId(null)} onEdit={(c) => { setOpenId(null); setForm(c); }} />}
    </div>
  );
}

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className}`}><Label className="text-[11px]">{label}</Label>{children}</div>;
}

function CargaForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const inp = (k: string, type = "text") => <Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />;
  return (
    <div className="grid grid-cols-2 gap-3">
      <F label="Número do transporte">{inp("numero_transporte")}</F>
      <F label="Transportadora de origem">{inp("transportadora")}</F>
      <F label="Fornecedor / embarcador" className="col-span-2">{inp("fornecedor")}</F>
      <F label="Motorista">{inp("motorista")}</F>
      <F label="Placa">{inp("placa")}</F>
      <F label="Data de carregamento na origem">{inp("data_carregamento", "date")}</F>
      <F label="Previsão de chegada">{inp("previsao_chegada", "date")}</F>
      <F label="Status">
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["prevista", "em_transito", "cancelada"].map((k) => <SelectItem key={k} value={k}>{ENTRADA_STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
        </Select>
      </F>
      <F label="Observações" className="col-span-2"><Textarea rows={2} value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></F>
      <p className="col-span-2 text-[11px] text-muted-foreground">"Recebida" só é marcada pelo botão Confirmar Chegada.</p>
    </div>
  );
}

function DetalheCarga({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: any) => void }) {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const xmlRef = useRef<HTMLInputElement>(null);
  const importMode = useRef<"individual" | "agrupada">("individual");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ importadas: number; erros: string[] } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [modo, setModo] = useState<"individual" | "agrupada">("individual");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [ocNota, setOcNota] = useState<any>(null);
  const { data } = useQuery({
    queryKey: ["carga-entrada", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cargas_entrada").select("*, notas_fiscais(*)").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });
  const notas: any[] = data?.notas_fiscais ?? [];
  const t = useMemo(() => sum(notas), [notas]);
  const grupos = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const n of notas) { const k = recipientGroupKey(n); m.set(k, [...(m.get(k) ?? []), n]); }
    return Array.from(m.entries()).map(([k, ns]) => ({ k, ns, t: sum(ns) })).sort((a, b) => String(a.ns[0].cliente).localeCompare(String(b.ns[0].cliente)));
  }, [notas]);
  const fechada = data && ["recebida", "cancelada"].includes(data.status);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["carga-entrada", id] }); qc.invalidateQueries({ queryKey: ["cargas-entrada"] }); qc.invalidateQueries({ queryKey: ["notas"] }); };

  async function importar(files: FileList) {
    setImportando(true);
    try {
      const { ok, erros, nomes } = await lerXmls(files);
      let importadas = 0;
      const gruposImportados = new Map<string, string>();
      for (const p of ok) {
        const destinatario = p.cnpj_destinatario.replace(/\D/g, "");
        if (importMode.current === "agrupada" && !destinatario) { erros.push(`${nomes.get(p.chave_nfe)}: destinatário sem CNPJ/CPF; importe individualmente`); continue; }
        if (!gruposImportados.has(destinatario)) gruposImportados.set(destinatario, crypto.randomUUID());
        const { error } = await supabase.from("notas_fiscais").insert({
          ...p, origem: "xml", status: "disponivel", recebida: false, carga_entrada_id: id,
          grupo_importacao: importMode.current === "agrupada" ? gruposImportados.get(destinatario) : null,
        });
        if (error) erros.push(`${nomes.get(p.chave_nfe)}: ${error.code === "23505" ? "NF já cadastrada; não foi duplicada" : error.message}`);
        else importadas++;
      }
      setModo(importMode.current);
      setResultado({ importadas, erros });
      refresh();
    } finally { setImportando(false); }
  }

  async function remover(nid: string) {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", nid).eq("recebida", false);
    if (error) toast.error(error.message); else refresh();
  }

  const acoes = (n: any) => canWrite && <div className="flex items-center gap-2 justify-end">
    <button title="Registrar Ocorrência" onClick={() => setOcNota(n)} className="text-warning-foreground hover:text-destructive inline-flex items-center gap-1 text-xs"><AlertTriangle className="h-3.5 w-3.5" />Ocorrência</button>
    {!n.recebida && <button title="Remover da carga" onClick={() => remover(n.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>}
  </div>;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Carga de entrada {data?.numero_transporte || ""} {data && <StatusBadge className={STATUS_COLOR[data.status]}>{ENTRADA_STATUS_LABEL[data.status]}</StatusBadge>}</DialogTitle></DialogHeader>
        {data && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div><span className="text-muted-foreground">Transportadora:</span> {data.transportadora || "—"}</div>
            <div><span className="text-muted-foreground">Fornecedor:</span> {data.fornecedor || "—"}</div>
            <div><span className="text-muted-foreground">Motorista:</span> {data.motorista || "—"} {data.placa && `• ${data.placa}`}</div>
            <div><span className="text-muted-foreground">Previsão:</span> {fmtDate(data.previsao_chegada && data.previsao_chegada + "T12:00")}</div>
            {data.data_chegada && <div className="col-span-2"><span className="text-muted-foreground">Recebida em:</span> {fmtDateTime(data.data_chegada)} por {data.recebido_por_nome || "—"}</div>}
            {data.obs_recebimento && <div className="col-span-2"><span className="text-muted-foreground">Obs. recebimento:</span> {data.obs_recebimento}</div>}
          </div>
          <div className="flex flex-wrap gap-4 rounded-md border bg-muted px-3 py-2 text-sm">
            <span>Notas <b>{t.notas}</b></span><span>Peso <b>{fmtNum(t.peso, 3)} kg</b></span>
            <span>Volumes <b>{fmtNum(t.volumes)}</b></span><span>Valor <b>{fmtBRL(t.valor)}</b></span>
          </div>
          {canWrite && <div className="flex flex-wrap gap-2">
            <input ref={xmlRef} type="file" accept=".xml" multiple className="hidden" onChange={(e) => { if (e.target.files) importar(e.target.files); e.target.value = ""; }} />
            {!fechada && <>
              <Button size="sm" variant="outline" disabled={importando} onClick={() => { importMode.current = "agrupada"; xmlRef.current?.click(); }}><Upload className="h-4 w-4 mr-1" />Importar Agrupado</Button>
              <Button size="sm" variant="outline" disabled={importando} onClick={() => { importMode.current = "individual"; xmlRef.current?.click(); }}><Upload className="h-4 w-4 mr-1" />Importar Individual</Button>
            </>}
            <Button size="sm" variant="outline" onClick={() => onEdit(data)}>Editar dados</Button>
            {!fechada && notas.some((n) => !n.recebida) && <Button size="sm" className="ml-auto" onClick={() => setConfirmar(true)}><CheckCircle2 className="h-4 w-4 mr-1" />Confirmar Chegada</Button>}
          </div>}
          {resultado && <div role="status" className="border rounded-md p-3 text-sm">
            <b>{resultado.importadas} nota(s) importada(s)</b>
            {resultado.erros.length > 0 && <><p className="text-destructive">{resultado.erros.length} arquivo(s) rejeitado(s)</p><ul className="list-disc pl-5 max-h-40 overflow-auto">{resultado.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></>}
          </div>}
          <div className="flex gap-1">
            <Button size="sm" variant={modo === "individual" ? "default" : "outline"} className="h-8" onClick={() => setModo("individual")}>Visualização Individual</Button>
            <Button size="sm" variant={modo === "agrupada" ? "default" : "outline"} className="h-8" onClick={() => setModo("agrupada")}>Visualização Agrupada por Cliente</Button>
          </div>
          <div className="border rounded-md overflow-auto">
            {modo === "individual" ? <table className="table-erp">
              <thead><tr><th>Nº NF</th><th>Fornecedor</th><th>Cliente</th><th>Cidade/UF</th><th className="text-right">Peso</th><th className="text-right">Vol.</th><th className="text-right">Valor</th><th>Recebida</th><th></th></tr></thead>
              <tbody>
                {notas.map((n) => <tr key={n.id}>
                  <td className="font-mono">{n.numero}<OcorrenciaBadge nota={n} /></td><td>{n.fornecedor}</td><td>{n.cliente}</td><td>{n.cidade}{n.uf && `/${n.uf}`}</td>
                  <td className="text-right">{fmtNum(n.peso, 3)}</td><td className="text-right">{n.volumes}</td><td className="text-right">{fmtBRL(n.valor)}</td>
                  <td>{n.recebida ? "Sim" : "Não"}</td>
                  <td>{acoes(n)}</td>
                </tr>)}
                {notas.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-6">Importe os XMLs das notas desta carga</td></tr>}
              </tbody>
            </table> : <table className="table-erp">
              <thead><tr><th></th><th>Cliente / destinatário</th><th>CNPJ</th><th>Cidade/UF</th><th className="text-right">Notas</th><th>Nº das NFs</th><th className="text-right">Peso</th><th className="text-right">Vol.</th><th className="text-right">Valor</th></tr></thead>
              <tbody>
                {grupos.map((g) => { const aberto = abertos.has(g.k); const f = g.ns[0]; return [
                  <tr key={g.k} className="cursor-pointer" onClick={() => { const s = new Set(abertos); aberto ? s.delete(g.k) : s.add(g.k); setAbertos(s); }}>
                    <td>{aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="font-semibold">{f.cliente}</td><td className="font-mono">{f.cnpj_destinatario || "—"}</td><td>{f.cidade}{f.uf && `/${f.uf}`}</td>
                    <td className="text-right">{g.t.notas}</td><td className="font-mono text-xs">{g.ns.map((n) => n.numero).join(", ")}</td>
                    <td className="text-right">{fmtNum(g.t.peso, 3)}</td><td className="text-right">{fmtNum(g.t.volumes)}</td><td className="text-right">{fmtBRL(g.t.valor)}</td>
                  </tr>,
                  aberto && <tr key={g.k + "-x"}><td></td><td colSpan={8} className="p-0">
                    <table className="table-erp"><thead><tr><th>Nº NF</th><th>Chave de acesso</th><th>Fornecedor</th><th>Cliente</th><th>Cidade</th><th className="text-right">Peso</th><th className="text-right">Vol.</th><th className="text-right">Valor</th><th></th></tr></thead>
                      <tbody>{g.ns.map((n) => <tr key={n.id}>
                        <td className="font-mono">{n.numero}<OcorrenciaBadge nota={n} /></td><td className="font-mono text-[10px]">{n.chave_nfe || "—"}</td><td>{n.fornecedor}</td><td>{n.cliente}</td>
                        <td>{n.cidade}</td><td className="text-right">{fmtNum(n.peso, 3)}</td><td className="text-right">{n.volumes}</td><td className="text-right">{fmtBRL(n.valor)}</td><td>{acoes(n)}</td>
                      </tr>)}</tbody></table>
                  </td></tr>,
                ]; })}
                {notas.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-6">Importe os XMLs das notas desta carga</td></tr>}
              </tbody>
            </table>}
          </div>
        </>}
        {ocNota && <RegistrarOcorrencia nota={ocNota} transporte={data?.numero_transporte} cargaEntradaId={id} onClose={() => setOcNota(null)} />}
        {confirmar && data && <ConfirmarChegada carga={data} onClose={() => setConfirmar(false)} onDone={refresh} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarChegada({ carga, onClose, onDone }: { carga: any; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const pendentes = (carga.notas_fiscais ?? []).filter((n: any) => !n.recebida);
  const agora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [quando, setQuando] = useState(agora);
  const [obs, setObs] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(pendentes.map((n: any) => n.id)));
  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("confirmar_chegada", {
        _carga: carga.id, _quando: new Date(quando).toISOString(), _obs: obs || null, _notas: Array.from(sel),
      } as any);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (st) => { toast.success(`Chegada confirmada — ${ENTRADA_STATUS_LABEL[st] ?? st}. Notas disponíveis no depósito.`); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Confirmar chegada</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <F label="Data e horário do recebimento"><Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></F>
          <F label="Responsável"><Input value={user?.email ?? ""} disabled /></F>
          <F label="Observações"><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></F>
          <div>
            <Label className="text-[11px]">Notas recebidas ({sel.size} de {pendentes.length}) — desmarque as que não chegaram</Label>
            <div className="max-h-48 overflow-auto border rounded mt-1">
              {pendentes.map((n: any) => <label key={n.id} className="flex items-center gap-2 px-2 py-1 text-sm border-b last:border-0">
                <input type="checkbox" checked={sel.has(n.id)} onChange={() => { const s = new Set(sel); s.has(n.id) ? s.delete(n.id) : s.add(n.id); setSel(s); }} />
                NF {n.numero} — {n.cliente} — {fmtNum(n.peso, 3)} kg
              </label>)}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending || sel.size === 0 || !quando} onClick={() => mut.mutate()}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
