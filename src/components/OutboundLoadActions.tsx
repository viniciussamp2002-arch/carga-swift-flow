import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { canEditOutboundLoad, canRemoveOutboundNotes } from "@/lib/load-lifecycle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EditarCargaButton({ carga }: { carga: any }) {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const { data: motoristas = [], isPending: loadingMotoristas } = useQuery({
    queryKey: ["edicao-carga-motoristas"], enabled: open,
    queryFn: async () => (await supabase.from("motoristas").select("id,nome,situacao").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: veiculos = [], isPending: loadingVeiculos } = useQuery({
    queryKey: ["edicao-carga-veiculos"], enabled: open,
    queryFn: async () => (await supabase.from("veiculos").select("id,placa,modelo,situacao").neq("situacao", "inativo").order("placa")).data ?? [],
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc("editar_carga_saida", {
        _id: carga.id, _motorista: motorista, _veiculo: veiculo,
        _data: (data || null) as any, _obs: obs,
      });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(`Carga #${carga.numero} atualizada`);
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!canWrite || !canEditOutboundLoad(carga)) return null;
  function openDialog() {
    setMotorista(carga.motorista_id ?? "");
    setVeiculo(carga.veiculo_id ?? "");
    setData(carga.data_prevista_saida ?? "");
    setObs(carga.observacoes ?? "");
    setOpen(true);
  }
  const loading = loadingMotoristas || loadingVeiculos;
  return <>
    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openDialog}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar carga #{carga.numero}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {carga.status === "em_rota" && <p className="rounded-md border border-warning/50 bg-warning/15 p-2">A carga está em rota. A edição não altera as entregas nem libera suas notas.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Motorista</Label>
              <Select value={motorista} onValueChange={setMotorista} disabled={loading || mutation.isPending}>
                <SelectTrigger aria-label="Motorista da carga"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{motoristas.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Veículo / placa</Label>
              <Select value={veiculo} onValueChange={setVeiculo} disabled={loading || mutation.isPending}>
                <SelectTrigger aria-label="Veículo da carga"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{veiculos.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.placa} • {item.modelo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor={`data-carga-${carga.id}`}>Data prevista</Label><Input id={`data-carga-${carga.id}`} type="date" value={data} onChange={(event) => setData(event.target.value)} disabled={mutation.isPending} /></div>
          <div className="space-y-1"><Label htmlFor={`obs-carga-${carga.id}`}>Observações</Label><Textarea id={`obs-carga-${carga.id}`} value={obs} onChange={(event) => setObs(event.target.value)} disabled={mutation.isPending} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancelar</Button><Button disabled={!motorista || !veiculo || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function RemoverNotaCargaButton({ carga, nota }: { carga: any; nota: any }) {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc("remover_notas_carga_saida", { _carga: carga.id, _notas: [nota.id], _motivo: motivo });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      toast.success(`NF ${nota.numero} devolvida ao Depósito`);
      setOpen(false);
      setMotivo("");
      qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!canWrite || !canRemoveOutboundNotes(carga) || !["separacao", "carregamento"].includes(nota.status)) return null;
  return <>
    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => setOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Remover</Button>
    <AlertDialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Remover NF {nota.numero} da carga #{carga.numero}?</AlertDialogTitle><AlertDialogDescription>A nota voltará ao Depósito como disponível. Recebimento, agendamento, observações e histórico serão preservados.</AlertDialogDescription></AlertDialogHeader>
        <div className="space-y-1"><Label htmlFor={`motivo-remover-${nota.id}`}>Motivo</Label><Textarea id={`motivo-remover-${nota.id}`} value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ex.: nota não sairá nesta viagem" disabled={mutation.isPending} /></div>
        <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>Voltar</AlertDialogCancel><Button variant="destructive" disabled={!motivo.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Removendo..." : "Remover e liberar nota"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
