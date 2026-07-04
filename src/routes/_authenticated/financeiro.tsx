import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, fmtKg } from "@/lib/format";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/financeiro")({ component: FinPage });

const SIT_LABEL: Record<string, string> = { pendente: "Pendente", faturado: "Faturado", recebido: "Recebido" };
const SIT_COLOR: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground border-warning/40",
  faturado: "bg-info/15 text-info border-info/30",
  recebido: "bg-success/15 text-success border-success/30",
};

function FinPage() {
  const { canWrite } = useAuth();
  const [edit, setEdit] = useState<any>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select(`*,
          notas_fiscais:nota_fiscal_id(numero,cliente,cidade,uf,peso,volumes,fornecedor,carga_id,
            cargas:carga_id(numero,motoristas:motorista_id(nome),veiculos:veiculo_id(placa))),
          fornecedores:fornecedor_id(nome)`)
        .order("data_entrega", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalFrete = rows.reduce((s: number, r: any) => s + Number(r.valor_frete ?? 0), 0);
  const totalPend = rows.filter((r: any) => r.situacao === "pendente").reduce((s: number, r: any) => s + Number(r.valor_frete ?? 0), 0);

  const columns: DataTableColumn<any>[] = useMemo(() => [
    { key: "nf", header: "NF", accessor: (r) => r.notas_fiscais?.numero, render: (r) => <span className="font-mono">{r.notas_fiscais?.numero ?? "—"}</span> },
    { key: "data", header: "Entrega", accessor: (r) => r.data_entrega, render: (r) => fmtDate(r.data_entrega) },
    { key: "cliente", header: "Cliente", accessor: (r) => r.notas_fiscais?.cliente ?? "" },
    { key: "fornecedor", header: "Fornecedor", accessor: (r) => r.fornecedores?.nome ?? r.notas_fiscais?.fornecedor ?? "" },
    { key: "cidade", header: "Cidade/UF", accessor: (r) => `${r.notas_fiscais?.cidade ?? ""}${r.notas_fiscais?.uf ? "/" + r.notas_fiscais.uf : ""}` },
    { key: "regiao", header: "Região", accessor: (r) => r.regiao ?? "" },
    { key: "peso", header: "Peso", accessor: (r) => Number(r.notas_fiscais?.peso ?? 0), align: "right", render: (r) => fmtKg(r.notas_fiscais?.peso) },
    { key: "vol", header: "Vol", accessor: (r) => Number(r.notas_fiscais?.volumes ?? 0), align: "right" },
    { key: "motorista", header: "Motorista", accessor: (r) => r.notas_fiscais?.cargas?.motoristas?.nome ?? "" },
    { key: "veiculo", header: "Veículo", accessor: (r) => r.notas_fiscais?.cargas?.veiculos?.placa ?? "" },
    { key: "valor", header: "Frete", accessor: (r) => Number(r.valor_frete ?? 0), align: "right", render: (r) => <span className="font-semibold">{fmtBRL(r.valor_frete)}</span> },
    {
      key: "situacao", header: "Situação", accessor: (r) => SIT_LABEL[r.situacao] ?? r.situacao,
      render: (r) => <StatusBadge className={SIT_COLOR[r.situacao]}>{SIT_LABEL[r.situacao]}</StatusBadge>,
    },
    {
      key: "acoes", header: "", accessor: () => "", filterable: false, sortable: false,
      render: (r) => canWrite && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEdit(r)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [canWrite]);

  return (
    <div>
      <PageHeader title="Financeiro" subtitle={`${rows.length} lançamento(s) — total ${fmtBRL(totalFrete)} (pendente ${fmtBRL(totalPend)})`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPI label="Total de fretes" value={fmtBRL(totalFrete)} />
        <KPI label="Pendentes" value={fmtBRL(totalPend)} accent="warning" />
        <KPI label="Faturados" value={fmtBRL(rows.filter((r: any) => r.situacao === "faturado").reduce((s: number, r: any) => s + Number(r.valor_frete ?? 0), 0))} accent="info" />
        <KPI label="Recebidos" value={fmtBRL(rows.filter((r: any) => r.situacao === "recebido").reduce((s: number, r: any) => s + Number(r.valor_frete ?? 0), 0))} accent="success" />
      </div>

      <DataTable data={rows} columns={columns} rowKey={(r: any) => r.id} exportName="financeiro" />
      {edit && <EditDialog row={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: "warning" | "info" | "success" }) {
  const color = accent === "warning" ? "text-warning-foreground" : accent === "info" ? "text-info" : accent === "success" ? "text-success" : "text-foreground";
  return (
    <div className="border rounded-md p-3 bg-card shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function EditDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    situacao: row.situacao, valor_frete: row.valor_frete, observacoes: row.observacoes ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financeiro").update({
        situacao: form.situacao,
        valor_frete: Number(form.valor_frete) || 0,
        observacoes: form.observacoes || null,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["financeiro"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Frete NF {row.notas_fiscais?.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded">
            <div><span className="text-muted-foreground">Base:</span> {fmtBRL(row.valor_base)}</div>
            <div><span className="text-muted-foreground">ICMS:</span> {fmtBRL(row.valor_icms)}</div>
            <div><span className="text-muted-foreground">Desconto:</span> {fmtBRL(row.valor_desconto)}</div>
            <div><span className="text-muted-foreground">Pedágio:</span> {fmtBRL(row.valor_pedagio)}</div>
            <div><span className="text-muted-foreground">Taxa Extra:</span> {fmtBRL(row.valor_taxa_extra)}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor do Frete</Label>
            <Input type="number" step="0.01" value={form.valor_frete} onChange={(e) => setForm({ ...form, valor_frete: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situação</Label>
            <Select value={form.situacao} onValueChange={(v) => setForm({ ...form, situacao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SIT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
