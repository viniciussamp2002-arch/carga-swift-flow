import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { NOTA_STATUS_LABEL, NOTA_STATUS_COLOR, fmtKg, fmtNum } from "@/lib/format";
import { parseNFeXml } from "@/lib/xml-parser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Plus, PackagePlus, Search, X } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() }).optional();

export const Route = createFileRoute("/_authenticated/notas")({
  component: NotasPage,
  validateSearch: searchSchema,
});

function NotasPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [q, setQ] = useState(search?.q ?? "");
  const [statusF, setStatusF] = useState("all");
  const [cidadeF, setCidadeF] = useState("");
  const [fornF, setFornF] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openManual, setOpenManual] = useState(false);
  const [openCarga, setOpenCarga] = useState(false);

  const { data: notas = [] } = useQuery({
    queryKey: ["notas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, cargas:carga_id(numero)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return notas.filter((n: any) => {
      if (statusF !== "all" && n.status !== statusF) return false;
      if (cidadeF && !n.cidade?.toLowerCase().includes(cidadeF.toLowerCase())) return false;
      if (fornF && !n.fornecedor?.toLowerCase().includes(fornF.toLowerCase())) return false;
      if (!term) return true;
      return [n.numero, n.cliente, n.cidade, n.fornecedor].some((v) =>
        String(v ?? "").toLowerCase().includes(term)
      );
    });
  }, [notas, q, statusF, cidadeF, fornF]);

  const selectedNotes = filtered.filter((n: any) => selected.has(n.id));
  const totals = selectedNotes.reduce(
    (acc: any, n: any) => ({
      peso: acc.peso + Number(n.peso ?? 0),
      vol: acc.vol + Number(n.volumes ?? 0),
      clientes: acc.clientes.add(n.cliente),
    }),
    { peso: 0, vol: 0, clientes: new Set() }
  );

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
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
      });
      if (error) err++; else ok++;
    }
    if (ok) toast.success(`${ok} nota(s) importada(s)`);
    if (dup) toast.warning(`${dup} nota(s) já existiam (ignoradas)`);
    if (err) toast.error(`${err} erro(s) na importação`);
    qc.invalidateQueries({ queryKey: ["notas"] });
    e.target.value = "";
  }

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle={`${fmtNum(filtered.length)} de ${fmtNum(notas.length)} notas`}
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

      <div className="bg-card border rounded-md p-3 mb-3 flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px]">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-7 h-8" placeholder="Nº NF, cliente, cidade..." />
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Status</Label>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(NOTA_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Cidade</Label>
          <Input value={cidadeF} onChange={(e) => setCidadeF(e.target.value)} className="h-8 w-40" />
        </div>
        <div>
          <Label className="text-[11px]">Fornecedor</Label>
          <Input value={fornF} onChange={(e) => setFornF(e.target.value)} className="h-8 w-44" />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 bg-card border rounded-md overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-auto">
            <table className="table-erp">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Nº NF</th>
                  <th>Fornecedor</th>
                  <th>Cliente</th>
                  <th>Cidade/UF</th>
                  <th className="text-right">Peso</th>
                  <th className="text-right">Vol</th>
                  <th>Agend</th>
                  <th>Carga</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n: any) => {
                  const sel = selected.has(n.id);
                  const canSelect = n.status === "disponivel";
                  return (
                    <tr key={n.id} className={sel ? "bg-primary/5" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel}
                          disabled={!canSelect || !canWrite}
                          onChange={() => toggle(n.id)}
                        />
                      </td>
                      <td className="font-mono">{n.numero}</td>
                      <td className="max-w-[180px] truncate">{n.fornecedor}</td>
                      <td className="max-w-[180px] truncate">{n.cliente}</td>
                      <td>{n.cidade}{n.uf && `/${n.uf}`}</td>
                      <td className="text-right">{fmtKg(n.peso)}</td>
                      <td className="text-right">{n.volumes}</td>
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
  const [form, setForm] = useState({
    numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "", volumes: "",
    fornecedor: "", agendamento: false, observacoes: "",
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
      setForm({ numero: "", cliente: "", cidade: "", uf: "", regiao: "", peso: "", volumes: "", fornecedor: "", agendamento: false, observacoes: "" });
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
