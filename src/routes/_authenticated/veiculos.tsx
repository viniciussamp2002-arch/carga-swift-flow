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
    queryFn: async () => (await supabase.from("veiculos").select("*, motoristas(nome)").order("placa")).data ?? [],
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
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {veiculos.map((v: any) => (
          <div key={v.id} className="bg-card border rounded-lg p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-2">
              {canWrite && v.situacao !== "em_rota" ? (
                <Select value={v.situacao} onValueChange={(s) => upd.mutate({ id: v.id, situacao: s })}>
                  <SelectTrigger className={`h-7 text-xs w-32 border ${SIT_COLOR[v.situacao] ?? ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VEICULO_SIT_LABEL).filter(([k]) => k !== "em_rota").map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge className={SIT_COLOR[v.situacao]}>{VEICULO_SIT_LABEL[v.situacao]}</StatusBadge>
              )}
              {canWrite && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEdit(v); setOpen(true); }}>Editar</Button>}
            </div>
            <div className="my-1 rounded-md border-2 border-foreground/80 bg-background py-2 text-center font-mono text-2xl font-bold tracking-widest">{v.placa}</div>
            <div className="text-sm font-semibold truncate">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Tipo: <span className="text-foreground">{v.tipo || "—"}</span></div>
              <div>Cap.: <span className="text-foreground">{fmtNum(v.capacidade_kg, 0)} kg</span>{v.ano ? ` · Ano ${v.ano}` : ""}</div>
              <div className="truncate">Motorista: <span className="text-foreground">{v.motoristas?.nome ?? "Sem vínculo"}</span></div>
            </div>
          </div>
        ))}
        {veiculos.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground bg-card border rounded-md">Nenhum veículo</div>}
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
      const { motoristas: _m, ...rest } = form; const payload = { ...rest, motorista_id: form.motorista_id || null, capacidade_kg: Number(form.capacidade_kg) || 0, ano: form.ano ? Number(form.ano) : null };
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
