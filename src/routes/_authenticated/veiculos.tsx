import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { VEICULO_SIT_LABEL, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => pageHead("Veículos", "Cadastro e disponibilidade da frota."), component: VeicPage });

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

  return (
    <div>
      <PageHeader
        title="Veículos"
        subtitle={`${fmtNum(veiculos.length)} cadastrados`}
        actions={canWrite && (
          <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      />
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="table-erp">
          <thead>
            <tr>
              <th>Placa</th><th>Marca / Modelo</th><th>Tipo</th>
              <th className="text-right">Cap. (kg)</th><th>Ano</th><th>Situação</th><th></th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v: any) => (
              <tr key={v.id}>
                <td className="font-mono font-semibold">{v.placa}</td>
                <td>{v.marca} {v.modelo}</td>
                <td>{v.tipo}</td>
                <td className="text-right">{fmtNum(v.capacidade_kg, 0)}</td>
                <td>{v.ano ?? "—"}</td>
                <td>
                  {canWrite && v.situacao !== "em_rota" ? (
                    <Select value={v.situacao} onValueChange={(s) => upd.mutate({ id: v.id, situacao: s })}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VEICULO_SIT_LABEL).filter(([k]) => k !== "em_rota").map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge className={SIT_COLOR[v.situacao]}>{VEICULO_SIT_LABEL[v.situacao]}</StatusBadge>
                  )}
                </td>
                <td>
                  {canWrite && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEdit(v); setOpen(true); }}>
                      Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {veiculos.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum veículo</td></tr>}
          </tbody>
        </table>
      </div>
      <VeicDialog key={edit?.id ?? `new-${open}`} open={open} onOpenChange={setOpen} edit={edit} />
    </div>
  );
}

function VeicDialog({ open, onOpenChange, edit }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(edit ?? {
    placa: "", marca: "", modelo: "", tipo: "", capacidade_kg: 0, ano: "", situacao: "disponivel",
  });
  const { data: drivers = [] } = useQuery({queryKey:["vehicle-drivers"],queryFn:async()=> (await supabase.from("motoristas").select("id,nome").eq("ativo",true).order("nome")).data??[]});

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, motorista_id: form.motorista_id || null, capacidade_kg: Number(form.capacidade_kg) || 0, ano: form.ano ? Number(form.ano) : null };
      if (edit) {
        const { error } = await supabase.from("veiculos").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("veiculos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["veiculos"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} Veículo</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Placa*", "placa"], ["Marca", "marca"], ["Modelo", "modelo"],
            ["Tipo", "tipo"], ["Capacidade (kg)", "capacidade_kg"], ["Ano", "ano"],
          ].map(([l, k]) => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]">{l}</Label>
              <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <Label>Motorista vinculado</Label><Select value={form.motorista_id||"none"} onValueChange={v=>setForm({...form,motorista_id:v==="none"?null:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Sem vínculo</SelectItem>{drivers.map(d=><SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select>
        <Label>Observações</Label><Input value={form.observacoes??""} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.placa}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
