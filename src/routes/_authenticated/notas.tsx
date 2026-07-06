import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { NOTA_STATUS_LABEL, NOTA_STATUS_COLOR, fmtKg, fmtNum, fmtDate } from "@/lib/format";
import { diasRestantes, prazoBadge } from "@/lib/prazo";
import { parseNFeXml } from "@/lib/xml-parser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Plus, PackagePlus, X, Package, Truck, PackageCheck, PackageOpen, CheckCircle2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

const BUCKETS: { key: string; label: string; icon: any; color: string; group?: boolean }[] = [
  { key: "disponivel", label: "Disponíveis", icon: Package, color: "text-blue-600 border-blue-500/40 bg-blue-500/10" },
  { key: "separacao", label: "Em Separação", icon: PackageOpen, color: "text-amber-700 border-amber-500/40 bg-amber-500/10", group: true },
  { key: "carregamento", label: "Carregamento", icon: PackageCheck, color: "text-orange-700 border-orange-500/40 bg-orange-500/10", group: true },
  { key: "em_rota", label: "Em Rota", icon: Truck, color: "text-purple-700 border-purple-500/40 bg-purple-500/10", group: true },
  { key: "entregue", label: "Entregues", icon: CheckCircle2, color: "text-emerald-700 border-emerald-500/40 bg-emerald-500/10", group: true },
  { key: "cancelada", label: "Canceladas", icon: Ban, color: "text-red-700 border-red-500/40 bg-red-500/10" },
];

export const Route = createFileRoute("/_authenticated/notas")({ component: NotasPage });

function NotasPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openManual, setOpenManual] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openManual, setOpenManual] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);
  const [bucket, setBucket] = useState<string>("disponivel");
  const [cargaFilter, setCargaFilter] = useState<string | null>(null);

  const { data: notas = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, cargas:carga_id(numero, veiculos:veiculo_id(placa), motoristas:motorista_id(nome))")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of notas as any[]) c[n.status] = (c[n.status] ?? 0) + 1;
    return c;
  }, [notas]);

  const bucketDef = BUCKETS.find((b) => b.key === bucket)!;
  const notasBucket = useMemo(
    () => (notas as any[]).filter((n) => n.status === bucket),
    [notas, bucket],
  );

  const cargaGroups = useMemo(() => {
    if (!bucketDef.group) return [];
    const map = new Map<string, { key: string; numero: number | null; placa: string; motorista: string; count: number }>();
    for (const n of notasBucket) {
      const key = n.carga_id ?? "__sem__";
      const g = map.get(key) ?? {
        key,
        numero: n.cargas?.numero ?? null,
        placa: n.cargas?.veiculos?.placa ?? "—",
        motorista: n.cargas?.motoristas?.nome ?? "—",
        count: 0,
      };
      g.count++;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0));
  }, [notasBucket, bucketDef.group]);

  const notasFiltered = useMemo(() => {
    if (!bucketDef.group || !cargaFilter) return notasBucket;
    return notasBucket.filter((n) => (n.carga_id ?? "__sem__") === cargaFilter);
  }, [notasBucket, cargaFilter, bucketDef.group]);

  const selectedNotes = (notas as any[]).filter((n) => selected.has(n.id));
  const totals = selectedNotes.reduce(
    (acc: any, n: any) => ({
      peso: acc.peso + Number(n.peso ?? 0),
      vol: acc.vol + Number(n.volumes ?? 0),
      clientes: acc.clientes.add(n.cliente),
    }),
    { peso: 0, vol: 0, clientes: new Set() },
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleXmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    let ok = 0, dup = 0, err = 0;
    for (const f of Array.from(files)) {
      const text = await f.text();
      const p = parseNFeXml(text);
      if ("error" in p) { err++; continue; }
      const exists = await supabase.from("notas_fiscais").select("id").eq("chave_nfe", p.chave_nfe).maybeSingle();
      if (exists.data) { dup++; continue; }
      const { error } = await supabase.from("notas_fiscais").insert({
        ...p, regiao: null, agendamento: false, origem: "xml", status: "disponivel",
        data_chegada: new Date().toISOString().slice(0, 10),
      });
      if (error) err++; else ok++;
    }
    if (ok) toast.success(`${ok} nota(s) importada(s)`);
    if (dup) toast.warning(`${dup} nota(s) já existiam (ignoradas)`);
    if (err) toast.error(`${err} erro(s) na importação`);
    qc.invalidateQueries({ queryKey: ["notas"] });
    e.target.value = "";
  }

  const columns: DataTableColumn<any>[] = useMemo(() => [
    {
      key: "sel", header: "", accessor: (n) => selected.has(n.id) ? "1" : "0",
      filterable: false, sortable: false, width: "36px",
      render: (n) => (
        <input
          type="checkbox"
          checked={selected.has(n.id)}
          disabled={n.status !== "disponivel" || !canWrite}
          onChange={() => toggle(n.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { key: "numero", header: "Nº NF", accessor: (n) => n.numero, render: (n) => <span className="font-mono font-medium">{n.numero}</span> },
    { key: "fornecedor", header: "Fornecedor", accessor: (n) => n.fornecedor, render: (n) => <span className="max-w-[180px] truncate block" title={n.fornecedor}>{n.fornecedor}</span> },
    { key: "cliente", header: "Cliente", accessor: (n) => n.cliente, render: (n) => <span className="max-w-[200px] truncate block" title={n.cliente}>{n.cliente}</span> },
    { key: "cidade", header: "Cidade/UF", accessor: (n) => `${n.cidade ?? ""}${n.uf ? "/" + n.uf : ""}` },
    { key: "peso", header: "Peso", accessor: (n) => Number(n.peso ?? 0), align: "right", render: (n) => fmtKg(n.peso), exportValue: (n) => Number(n.peso ?? 0) },
    { key: "volumes", header: "Vol", accessor: (n) => Number(n.volumes ?? 0), align: "right" },
    { key: "chegada", header: "Chegada", accessor: (n) => n.data_chegada, render: (n) => fmtDate(n.data_chegada) },
    {
      key: "prazo", header: "Prazo",
      accessor: (n) => diasRestantes(n.data_limite) ?? 9999,
      exportValue: (n) => diasRestantes(n.data_limite),
      render: (n) => {
        const d = diasRestantes(n.data_limite);
        const b = prazoBadge(d);
        return <StatusBadge className={b.className}>{b.label}</StatusBadge>;
      },
    },
    { key: "carga", header: "Carga", accessor: (n) => n.cargas?.numero ?? "", render: (n) => n.cargas ? `#${n.cargas.numero}` : "—" },
    {
      key: "status", header: "Status", accessor: (n) => NOTA_STATUS_LABEL[n.status],
      render: (n) => <StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge>,
    },
  ], [selected, canWrite]);

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle={`${fmtNum(notas.length)} nota(s) no total`}
        actions={
          canWrite && (
            <>
              <label className="inline-flex">
                <input type="file" accept=".xml" multiple className="hidden" onChange={handleXmlUpload} />
                <span className="inline-flex items-center gap-2 h-9 px-3 text-sm rounded-md bg-secondary hover:bg-accent cursor-pointer border border-border">
                  <Upload className="h-4 w-4" /> Importar XML
                </span>
              </label>
              <Button onClick={() => setOpenManual(true)} variant="outline" size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1" />Manual
              </Button>
            </>
          )
        }
      />

      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <DataTable
            data={notas}
            columns={columns}
            rowKey={(n: any) => n.id}
            exportName="notas_fiscais"
            rowClassName={(n: any) => selected.has(n.id) ? "bg-primary/5" : ""}
          />
        </div>

        {selected.size > 0 && (
          <aside className="w-72 bg-card border rounded-md p-4 h-fit sticky top-0 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">Carga em formação</h3>
              <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Notas</span><span className="font-bold">{selected.size}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peso total</span><span className="font-bold">{fmtKg(totals.peso)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Volumes</span><span className="font-bold">{fmtNum(totals.vol)}</span></div>
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
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "", volumes: "",
    fornecedor: "", cnpj_emissor: "", agendamento: false, observacoes: "", data_chegada: today,
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notas_fiscais").insert({
        ...form,
        peso: Number(form.peso) || 0,
        volumes: parseInt(form.volumes) || 0,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota cadastrada");
      qc.invalidateQueries({ queryKey: ["notas"] });
      onOpenChange(false);
      setForm({ numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "", volumes: "", fornecedor: "", cnpj_emissor: "", agendamento: false, observacoes: "", data_chegada: today });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cadastrar Nota Manual</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número NF*"><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
          <Field label="Data de Chegada"><Input type="date" value={form.data_chegada} onChange={(e) => setForm({ ...form, data_chegada: e.target.value })} /></Field>
          <Field label="Fornecedor"><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></Field>
          <Field label="CNPJ Fornecedor"><Input value={form.cnpj_emissor} onChange={(e) => setForm({ ...form, cnpj_emissor: e.target.value })} /></Field>
          <Field label="Cliente" className="col-span-2"><Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Cidade"><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></Field>
          <Field label="UF"><Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} maxLength={2} /></Field>
          <Field label="Região"><Input value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} /></Field>
          <Field label="Peso (kg)"><Input type="number" step="0.001" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} /></Field>
          <Field label="Volumes"><Input type="number" value={form.volumes} onChange={(e) => setForm({ ...form, volumes: e.target.value })} /></Field>
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
