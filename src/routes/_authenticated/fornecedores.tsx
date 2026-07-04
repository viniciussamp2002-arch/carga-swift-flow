import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores")({ component: FornPage });

const TIPO_LABEL: Record<string, string> = {
  por_tonelada: "R$/tonelada", por_kg: "R$/kg", por_volume: "R$/volume",
  fixo: "Valor fixo", por_nf: "Valor por NF",
};

function FornPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").order("nome")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fornecedor excluído"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const columns: DataTableColumn<any>[] = useMemo(() => [
    { key: "nome", header: "Nome", accessor: (f) => f.nome, render: (f) => <span className="font-medium">{f.nome}</span> },
    { key: "cnpj", header: "CNPJ", accessor: (f) => f.cnpj, render: (f) => <span className="font-mono text-xs">{f.cnpj}</span> },
    { key: "tipo", header: "Tipo Cálculo", accessor: (f) => TIPO_LABEL[f.tipo_calculo] ?? f.tipo_calculo },
    { key: "valor_base", header: "Valor Base", accessor: (f) => Number(f.valor_base ?? 0), align: "right", render: (f) => fmtBRL(f.valor_base) },
    { key: "icms", header: "ICMS", accessor: (f) => Number(f.icms_percent ?? 0), align: "right", render: (f) => `${f.icms_percent}%` },
    { key: "minimo", header: "Mínimo", accessor: (f) => Number(f.valor_minimo ?? 0), align: "right", render: (f) => fmtBRL(f.valor_minimo) },
    { key: "pedagio", header: "Pedágio", accessor: (f) => Number(f.pedagio ?? 0), align: "right", render: (f) => fmtBRL(f.pedagio) },
    { key: "extra", header: "Taxa Extra", accessor: (f) => Number(f.taxa_extra ?? 0), align: "right", render: (f) => fmtBRL(f.taxa_extra) },
    {
      key: "acoes", header: "Ações", accessor: () => "", filterable: false, sortable: false,
      render: (f) => canWrite && (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEdit(f); setOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`Excluir ${f.nome}?`)) del.mutate(f.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [canWrite]);

  return (
    <div>
      <PageHeader
        title="Fornecedores & Regras de Frete"
        subtitle="Configure a regra de cálculo de frete de cada fornecedor"
        actions={canWrite && (
          <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      />
      <DataTable data={fornecedores} columns={columns} rowKey={(f: any) => f.id} exportName="fornecedores" />
      <FornDialog open={open} onOpenChange={setOpen} edit={edit} key={edit?.id ?? "new"} />
    </div>
  );
}

function FornDialog({ open, onOpenChange, edit }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(edit ?? {
    nome: "", cnpj: "", tipo_calculo: "por_tonelada",
    valor_base: 0, icms_percent: 0, desconto_percent: 0,
    valor_minimo: 0, pedagio: 0, taxa_extra: 0, observacoes: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        valor_base: Number(form.valor_base) || 0,
        icms_percent: Number(form.icms_percent) || 0,
        desconto_percent: Number(form.desconto_percent) || 0,
        valor_minimo: Number(form.valor_minimo) || 0,
        pedagio: Number(form.pedagio) || 0,
        taxa_extra: Number(form.taxa_extra) || 0,
      };
      if (edit) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const F = ({ label, k, type = "text", step, className = "" }: any) => (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[11px]">{label}</Label>
      <Input type={type} step={step} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <F label="Nome*" k="nome" className="col-span-2" />
          <F label="CNPJ*" k="cnpj" />
          <div className="space-y-1">
            <Label className="text-[11px]">Tipo de Cálculo</Label>
            <Select value={form.tipo_calculo} onValueChange={(v) => setForm({ ...form, tipo_calculo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <F label="Valor Base (R$)" k="valor_base" type="number" step="0.01" />
          <F label="Valor Mínimo (R$)" k="valor_minimo" type="number" step="0.01" />
          <F label="ICMS (%)" k="icms_percent" type="number" step="0.001" />
          <F label="Desconto (%)" k="desconto_percent" type="number" step="0.001" />
          <F label="Pedágio (R$)" k="pedagio" type="number" step="0.01" />
          <F label="Taxa Extra (R$)" k="taxa_extra" type="number" step="0.01" />
          <div className="space-y-1 col-span-2">
            <Label className="text-[11px]">Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Fórmula: <b>base</b> = valor × (peso/1000 | peso | volumes | fixo) <span className="opacity-60">→ nunca menor que Mínimo</span>.
          <br />Total = base + <b>ICMS</b> − Desconto + Pedágio + Taxa Extra.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nome || !form.cnpj}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
