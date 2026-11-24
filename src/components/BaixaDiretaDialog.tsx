import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

export function BaixaDiretaDialog({ nota, open, onClose, userId }: { nota: any; open: boolean; onClose: () => void; userId: string }) {
  const qc = useQueryClient();
  const [data, setData] = useState(hoje());
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setData(hoje()); setMotorista(""); setVeiculo(""); setFile(null); setObs(""); } }, [open, nota?.id]);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const { data: mots = [] } = useQuery({ queryKey: ["baixa-motoristas"], enabled: open, queryFn: async () => (await supabase.from("motoristas").select("id,nome,ativo").eq("ativo", true).order("nome")).data ?? [] });
  const { data: veics = [] } = useQuery({ queryKey: ["baixa-veiculos"], enabled: open, queryFn: async () => (await supabase.from("veiculos").select("id,placa,modelo,motorista_id").order("placa")).data ?? [] });
  const ok = !!(data && motorista && veiculo && file && !busy);

  const confirmar = async () => {
    if (!file || !ok) return;
    if (!/^(image\/|application\/pdf)/.test(file.type)) return toast.error("Envie foto ou PDF do canhoto");
    if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo acima de 15 MB");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg")).toLowerCase();
      const path = `escritorio/${userId}/${nota.id}-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("comprovantes").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error("Falha ao enviar o canhoto; baixa não concluída");
      const { error } = await supabase.rpc("baixa_direta_entrega", { _nota: nota.id, _data: data, _motorista: motorista, _veiculo: veiculo, _path: path, _obs: obs.trim() });
      if (error) throw error;
      toast.success(`NF ${nota.numero} entregue — enviada para Notas Entregues`);
      qc.invalidateQueries();
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Erro na baixa"); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Dar baixa de entrega</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-2">
            <div><div className="text-xs text-muted-foreground">NF</div><b className="font-mono">{nota?.numero}</b></div>
            <div><div className="text-xs text-muted-foreground">Cliente</div><b>{nota?.cliente}</b></div>
            <div><div className="text-xs text-muted-foreground">Fornecedor</div><b>{nota?.fornecedor}</b></div>
          </div>
          <div><Label>Data efetiva da entrega *</Label><Input type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Motorista *</Label>
            <Select value={motorista} onValueChange={(v) => { setMotorista(v); const vc = (veics as any[]).find((x) => x.motorista_id === v); if (vc && !veiculo) setVeiculo(vc.id); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(mots as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Placa do veículo *</Label>
            <Select value={veiculo} onValueChange={setVeiculo}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(veics as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Canhoto assinado (foto ou PDF) *</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          {preview && file && (file.type === "application/pdf"
            ? <a className="text-primary underline" href={preview} target="_blank" rel="noreferrer">Visualizar PDF anexado</a>
            : <img src={preview} alt="Prévia do canhoto" className="max-h-56 rounded border object-contain" />)}
          <div><Label>Observação</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button disabled={!ok} onClick={confirmar}>{busy ? "Registrando…" : "Confirmar baixa de entrega"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
