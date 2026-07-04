import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import {
  CARGA_STATUS_LABEL, NOTA_STATUS_COLOR, NOTA_STATUS_LABEL,
  fmtDate, fmtDateTime, fmtKg, fmtNum,
} from "@/lib/format";
import { diasRestantes, prazoBadge } from "@/lib/prazo";
import { ArrowLeft, Trash2, PackagePlus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/cargas/$id")({ component: CargaDetail });

function CargaDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { canWrite } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const { data: carga } = useQuery({
    queryKey: ["carga", id],
    queryFn: async () => {
      const { data } = await supabase.from("cargas")
        .select("*, motoristas:motorista_id(id,nome,telefone), veiculos:veiculo_id(id,placa,modelo,marca)")
        .eq("id", id).single();
      return data;
    },
  });
  const { data: notas = [] } = useQuery({
    queryKey: ["carga-notas", id],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("carga_id", id).order("cidade")).data ?? [],
  });
  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas-all"],
    queryFn: async () => (await supabase.from("motoristas").select("id,nome,situacao")).data ?? [],
  });
  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-all"],
    queryFn: async () => (await supabase.from("veiculos").select("id,placa,modelo,situacao")).data ?? [],
  });

  const editable = carga && carga.status !== "em_rota" && carga.status !== "finalizada" && canWrite;

  const removeNota = useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase.from("notas_fiscais")
        .update({ carga_id: null, status: "disponivel" }).eq("id", notaId);
      if (error) throw error;
      await supabase.from("historico").insert({
        entidade: "nota", entidade_id: notaId, acao: "removida_carga",
        descricao: `Nota removida da carga #${carga?.numero}`,
      });
    },
    onSuccess: () => { toast.success("Nota removida"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveCarga = useMutation({
    mutationFn: async () => {
      if (!editForm) return;
      const { error } = await supabase.from("cargas").update({
        motorista_id: editForm.motorista_id || null,
        veiculo_id: editForm.veiculo_id || null,
        data_prevista_saida: editForm.data_prevista_saida || null,
        observacoes: editForm.observacoes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Carga atualizada"); qc.invalidateQueries(); setEditForm(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const delCarga = useMutation({
    mutationFn: async () => {
      // libera notas
      await supabase.from("notas_fiscais").update({ carga_id: null, status: "disponivel" }).eq("carga_id", id);
      // libera recursos
      if (carga?.veiculo_id) await supabase.from("veiculos").update({ situacao: "disponivel" }).eq("id", carga.veiculo_id);
      if (carga?.motorista_id) await supabase.from("motoristas").update({ situacao: "disponivel" }).eq("id", carga.motorista_id);
      await supabase.from("historico").insert({
        entidade: "carga", entidade_id: id, acao: "excluida",
        descricao: `Carga #${carga?.numero} excluída — notas retornaram ao estoque`,
      });
      const { error } = await supabase.from("cargas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Carga excluída"); qc.invalidateQueries(); nav({ to: "/cargas" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const notaColumns: DataTableColumn<any>[] = useMemo(() => [
    { key: "numero", header: "Nº NF", accessor: (n) => n.numero, render: (n) => <span className="font-mono">{n.numero}</span> },
    { key: "cliente", header: "Cliente", accessor: (n) => n.cliente },
    { key: "cidade", header: "Cidade/UF", accessor: (n) => `${n.cidade ?? ""}${n.uf ? "/" + n.uf : ""}` },
    { key: "regiao", header: "Região", accessor: (n) => n.regiao ?? "" },
    { key: "peso", header: "Peso", accessor: (n) => Number(n.peso ?? 0), align: "right", render: (n) => fmtKg(n.peso) },
    { key: "volumes", header: "Vol", accessor: (n) => Number(n.volumes ?? 0), align: "right" },
    {
      key: "prazo", header: "Prazo", accessor: (n) => diasRestantes(n.data_limite) ?? 9999,
      render: (n) => { const d = diasRestantes(n.data_limite); const b = prazoBadge(d); return <StatusBadge className={b.className}>{b.label}</StatusBadge>; },
    },
    {
      key: "status", header: "Status", accessor: (n) => NOTA_STATUS_LABEL[n.status],
      render: (n) => <StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge>,
    },
    {
      key: "acoes", header: "", accessor: () => "", filterable: false, sortable: false,
      render: (n) => editable && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`Remover NF ${n.numero}?`)) removeNota.mutate(n.id); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [editable, removeNota, carga?.numero]);

  if (!carga) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;

  const totPeso = notas.reduce((s: number, n: any) => s + Number(n.peso || 0), 0);
  const totVol = notas.reduce((s: number, n: any) => s + Number(n.volumes || 0), 0);

  return (
    <div>
      <Link to="/cargas" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
        <ArrowLeft className="h-3 w-3" />Voltar
      </Link>
      <PageHeader
        title={`Carga #${carga.numero}`}
        subtitle={`Criada em ${fmtDateTime(carga.created_at)} • ${CARGA_STATUS_LABEL[carga.status]}`}
        actions={
          <div className="flex gap-2">
            {editable && !editForm && (
              <Button size="sm" variant="outline" onClick={() => setEditForm({
                motorista_id: carga.motorista_id ?? "",
                veiculo_id: carga.veiculo_id ?? "",
                data_prevista_saida: carga.data_prevista_saida ?? "",
                observacoes: carga.observacoes ?? "",
              })}>
                Editar carga
              </Button>
            )}
            {editable && (
              <>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <PackagePlus className="h-4 w-4 mr-1" />Adicionar notas
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { if (confirm("Excluir esta carga? As notas retornam ao estoque.")) delCarga.mutate(); }}>
                  <Trash2 className="h-4 w-4 mr-1" />Excluir
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Info label="Motorista" value={carga.motoristas?.nome ?? "—"} sub={carga.motoristas?.telefone} />
        <Info label="Veículo" value={carga.veiculos?.placa ?? "—"} sub={`${carga.veiculos?.marca ?? ""} ${carga.veiculos?.modelo ?? ""}`} />
        <Info label="Data prevista" value={fmtDate(carga.data_prevista_saida)} />
        <Info label="Totais" value={`${notas.length} notas`} sub={`${fmtKg(totPeso)} • ${fmtNum(totVol)} vol`} />
      </div>

      {editForm && (
        <div className="bg-card border rounded-md p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div className="space-y-1"><Label className="text-[11px]">Motorista</Label>
              <Select value={editForm.motorista_id} onValueChange={(v) => setEditForm({ ...editForm, motorista_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Nenhum —</SelectItem>
                  {motoristas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-[11px]">Veículo</Label>
              <Select value={editForm.veiculo_id} onValueChange={(v) => setEditForm({ ...editForm, veiculo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Nenhum —</SelectItem>
                  {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} • {v.modelo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-[11px]">Data prevista</Label>
              <Input type="date" value={editForm.data_prevista_saida ?? ""} onChange={(e) => setEditForm({ ...editForm, data_prevista_saida: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2 lg:col-span-1"><Label className="text-[11px]">Observações</Label>
              <Input value={editForm.observacoes ?? ""} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditForm(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => saveCarga.mutate()}><Save className="h-3.5 w-3.5 mr-1" />Salvar</Button>
          </div>
        </div>
      )}

      <DataTable
        data={notas}
        columns={notaColumns}
        rowKey={(n: any) => n.id}
        exportName={`carga_${carga.numero}_notas`}
        emptyMessage="Nenhuma nota nesta carga"
      />

      {addOpen && <AdicionarNotasDialog cargaId={id} cargaNum={carga.numero} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3 bg-card shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AdicionarNotasDialog({ cargaId, cargaNum, onClose }: { cargaId: string; cargaNum: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { data: disp = [] } = useQuery({
    queryKey: ["notas-disponiveis"],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("status", "disponivel").is("carga_id", null).order("data_limite")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const ids = Array.from(sel);
      const { error } = await supabase.from("notas_fiscais").update({ carga_id: cargaId, status: "separacao" }).in("id", ids);
      if (error) throw error;
      await supabase.from("historico").insert({
        entidade: "carga", entidade_id: cargaId, acao: "notas_adicionadas",
        descricao: `${ids.length} nota(s) adicionadas à carga #${cargaNum}`,
      });
    },
    onSuccess: () => { toast.success("Notas adicionadas"); qc.invalidateQueries(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Adicionar notas à carga #{cargaNum}</DialogTitle></DialogHeader>
        <div className="max-h-[400px] overflow-auto border rounded">
          <table className="table-pro">
            <thead><tr><th style={{ width: 36 }}></th><th>NF</th><th>Fornecedor</th><th>Cliente</th><th>Cidade</th><th className="text-right">Peso</th><th>Prazo</th></tr></thead>
            <tbody>
              {disp.map((n: any) => {
                const d = diasRestantes(n.data_limite); const b = prazoBadge(d);
                const checked = sel.has(n.id);
                return (
                  <tr key={n.id}>
                    <td><input type="checkbox" checked={checked} onChange={() => {
                      setSel((prev) => { const s = new Set(prev); s.has(n.id) ? s.delete(n.id) : s.add(n.id); return s; });
                    }} /></td>
                    <td className="font-mono">{n.numero}</td>
                    <td className="max-w-[160px] truncate">{n.fornecedor}</td>
                    <td className="max-w-[160px] truncate">{n.cliente}</td>
                    <td>{n.cidade}/{n.uf}</td>
                    <td className="text-right">{fmtKg(n.peso)}</td>
                    <td><StatusBadge className={b.className}>{b.label}</StatusBadge></td>
                  </tr>
                );
              })}
              {disp.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma nota disponível</td></tr>}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => add.mutate()} disabled={sel.size === 0 || add.isPending}>Adicionar {sel.size} nota(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
