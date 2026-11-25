import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARGA_STATUS_LABEL, fmtBRL, fmtDate, fmtNum } from "@/lib/format";
import { toast } from "sonner";

/** Alternative way to start or complement an outbound load from Depósito; the server RPC enforces duplicate and status rules. */
export function RotaEntregaDialog({ notas, onClose }: { notas: any[]; onClose: (ok: boolean) => void }) {
  const qc = useQueryClient();
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [carga, setCarga] = useState("__nova__");
  const { data: motoristas = [] } = useQuery({ queryKey: ["rota-motoristas"], queryFn: async () => (await supabase.from("motoristas").select("id,nome,situacao").eq("ativo", true).order("nome")).data ?? [] });
  const { data: veiculos = [] } = useQuery({ queryKey: ["rota-veiculos"], queryFn: async () => (await supabase.from("veiculos").select("id,placa,modelo,marca,tipo,capacidade_kg,motorista_id,situacao").neq("situacao", "inativo").order("placa")).data ?? [] });
  const { data: cargas = [] } = useQuery({
    queryKey: ["rota-cargas"],
    queryFn: async () => (await supabase.from("cargas").select("id,numero,status,data_prevista_saida,motorista_id,veiculo_id,notas_fiscais(id,peso)").eq("situacao", "ativa").in("status", ["separacao", "carregamento", "em_rota"]).order("numero", { ascending: false })).data ?? [],
  });
  const v = veiculos.find((x: any) => x.id === veiculo);
  const compat = useMemo(() => cargas.filter((c: any) => motorista && veiculo && c.motorista_id === motorista && c.veiculo_id === veiculo), [cargas, motorista, veiculo]);
  const escolhida = cargas.find((c: any) => c.id === carga);
  const tot = notas.reduce((a, n) => ({ peso: a.peso + Number(n.peso ?? 0), vol: a.vol + Number(n.volumes ?? 0), valor: a.valor + Number(n.valor ?? 0) }), { peso: 0, vol: 0, valor: 0 });
  const bloqueadas = notas.filter((n) => n.carga_id || n.status === "entregue");
  const mut = useMutation({
    mutationFn: async () => {
      let confirmar = false;
      if (escolhida?.status === "em_rota") { if (!confirm(`A carga #${escolhida.numero} já está em rota. Confirmar a inclusão das notas?`)) throw new Error("Inclusão cancelada"); confirmar = true; }
      const r = await supabase.rpc("adicionar_rota_entrega", { _notas: notas.map((n) => n.id), _carga: (carga === "__nova__" ? null : carga) as any, _motorista: motorista || null as any, _veiculo: veiculo || null as any, _data: (data || null) as any, _obs: obs, _confirmar_em_rota: confirmar });
      if (r.error) throw r.error;
      return r.data as any;
    },
    onSuccess: (r) => { toast.success(r.nova ? `Carga #${r.numero} criada em montagem com ${notas.length} nota(s)` : `${notas.length} nota(s) adicionada(s) à carga #${r.numero}`); qc.invalidateQueries(); onClose(true); },
    onError: (e: any) => e.message !== "Inclusão cancelada" && toast.error(e.message),
  });
  const sel = "h-10 w-full rounded-md border bg-background px-2";
  return <Dialog open onOpenChange={(o) => !o && onClose(false)}><DialogContent className="max-w-2xl max-h-[92vh] overflow-auto">
    <DialogHeader><DialogTitle>Adicionar à rota de entrega ({notas.length} nota(s))</DialogTitle></DialogHeader>
    <div className="space-y-3 text-sm">
      <p className="max-h-24 overflow-auto text-muted-foreground">{notas.map((n) => `NF ${n.numero} – ${n.cliente} (${n.cidade})`).join("; ")}</p>
      <p>Peso <b>{fmtNum(tot.peso, 3)} kg</b> • Volumes <b>{fmtNum(tot.vol)}</b> • Valor <b>{fmtBRL(tot.valor)}</b></p>
      {bloqueadas.length > 0 && <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive">{bloqueadas.map((n) => `NF ${n.numero}${n.status === "entregue" ? " já entregue" : ` já está na carga #${n.cargas?.numero ?? "?"}`}`).join("; ")}. Remova-as da seleção.</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>Motorista</Label><select className={sel} value={motorista} onChange={(e) => { setMotorista(e.target.value); setCarga("__nova__"); }}><option value="">Selecione...</option>{motoristas.map((m: any) => <option key={m.id} value={m.id}>{m.nome}{m.situacao !== "disponivel" ? ` (${m.situacao})` : ""}</option>)}</select></div>
        <div><Label>Veículo</Label><select className={sel} value={veiculo} onChange={(e) => { setVeiculo(e.target.value); setCarga("__nova__"); const vv = veiculos.find((x: any) => x.id === e.target.value); if (vv?.motorista_id && !motorista) setMotorista(vv.motorista_id); }}><option value="">Selecione...</option>{veiculos.map((x: any) => <option key={x.id} value={x.id}>{x.placa} • {x.modelo}</option>)}</select></div>
      </div>
      {v && <p className="text-xs text-muted-foreground">Placa <b>{v.placa}</b> • {v.marca} {v.modelo} • {v.tipo} • capacidade {fmtNum(v.capacidade_kg)} kg</p>}
      {motorista && veiculo && <div><Label>Carga de saída</Label>
        <div className="space-y-1 mt-1">
          <label className="flex items-center gap-2"><input type="radio" checked={carga === "__nova__"} onChange={() => setCarga("__nova__")} />Criar nova carga (em montagem)</label>
          {compat.map((c: any) => { const p = (c.notas_fiscais ?? []).reduce((s: number, n: any) => s + Number(n.peso ?? 0), 0); return <label key={c.id} className="flex items-center gap-2">
            <input type="radio" checked={carga === c.id} onChange={() => setCarga(c.id)} />Carga #{c.numero} • {fmtDate(c.data_prevista_saida && c.data_prevista_saida + "T12:00") || "sem data"} • {c.status === "em_rota" ? "Em rota" : `Em montagem (${CARGA_STATUS_LABEL[c.status]})`} • {(c.notas_fiscais ?? []).length} NF • {fmtNum(p, 3)} kg</label>; })}
          {!compat.length && <p className="text-xs text-muted-foreground">Nenhuma carga ativa deste motorista com este veículo.</p>}
        </div></div>}
      {carga === "__nova__" && <div><Label>Data da rota</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>}
      <div><Label>Observação (opcional)</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">A nota fica "em montagem" até a carga iniciar a rota em Montagem de Cargas. Adicionar à rota não conclui a entrega.</p>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
      <Button disabled={!motorista || !veiculo || bloqueadas.length > 0 || mut.isPending} onClick={() => mut.mutate()}>{carga === "__nova__" ? "Criar carga e adicionar" : "Adicionar à carga"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
