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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VEICULO_SIT_LABEL, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/veiculos")({ component: VeicPage });

const SIT_COLOR: Record<string, string> = {
  disponivel: "bg-success/15 text-success border-success/30",
  em_rota: "bg-primary/15 text-primary border-primary/30",
  manutencao: "bg-warning/20 text-warning-foreground border-warning/40",
  inativo: "bg-muted text-muted-foreground border-border",
};

function VeicPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos"],
    queryFn: async () => (await supabase.from("veiculos").select("*").order("placa")).data ?? [],
  });

  const upd = useMutation({
    mutationFn: async ({ id, situacao }: any) => {
      const { error } = await supabase.from("veiculos").update({ situacao }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["veiculos"] }),
  });

  const columns: DataTableColumn<any>[] = useMemo(() => [
    { key: "placa", header: "Placa", accessor: (v) => v.placa, render: (v) => <span className="font-mono font-semibold">{v.placa}</span> },
    { key: "marca", header: "Marca / Modelo", accessor: (v) => `${v.marca ?? ""} ${v.modelo ?? ""}`.trim() },
    { key: "tipo", header: "Tipo", accessor: (v) => v.tipo ?? "" },
    { key: "cap", header: "Cap. (kg)", accessor: (v) => Number(v.capacidade_kg ?? 0), align: "right", render: (v) => fmtNum(v.capacidade_kg, 0) },
    { key: "ano", header: "Ano", accessor: (v) => v.ano ?? "" },
    {
      key: "sit", header: "Situação", accessor: (v) => VEICULO_SIT_LABEL[v.situacao],
      render: (v) => canWrite && v.situacao !== "em_rota" ? (
        <Select value={v.situacao} onValueChange={(s) => upd.mutate({ id: v.id, situacao: s })}>
          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(VEICULO_SIT_LABEL).filter(([k]) => k !== "em_rota").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : <StatusBadge className={SIT_COLOR[v.situacao]}>{VEICULO_SIT_LABEL[v.situacao]}</StatusBadge>,
    },
    {
      key: "acoes", header: "", accessor: () => "", filterable: false, sortable: false,
      render: (v) => canWrite && (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEdit(v); setOpen(true); }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [canWrite, upd]);

  return (
    <div>
      <PageHeader
        title="Veículos" subtitle={`${fmtNum(veiculos.length)} cadastrados`}
        actions={canWrite && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      />
      <DataTable data={veiculos} columns={columns} rowKey={(v: any) => v.id} exportName="veiculos" />
      <VeicDialog open={open} onOpenChange={setOpen} edit={edit} key={edit?.id ?? "new"} />
    </div>
  );
}

function VeicDialog({ open, onOpenChange, edit }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(edit ?? {
    placa: "", marca: "", modelo: "", tipo: "", capacidade_kg: 0, ano: "", situacao: "disponivel",
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, capacidade_kg: Number(form.capacidade_kg) || 0, ano: form.ano ? Number(form.ano) : null };
      if (edit) {
        const { error } = await supabase.from("veiculos").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("veiculos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["veiculos"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} Veículo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {[["Placa*", "placa"], ["Marca", "marca"], ["Modelo", "modelo"], ["Tipo", "tipo"], ["Capacidade (kg)", "capacidade_kg"], ["Ano", "ano"]].map(([l, k]) => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]">{l}</Label>
              <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.placa}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
