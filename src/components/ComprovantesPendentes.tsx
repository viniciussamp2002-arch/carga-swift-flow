import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reconhecerComprovante } from "@/lib/proofs.functions";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isAwaitingProofReview, PENDING_PROOF_STATUSES, PROOF_TYPES } from "@/lib/proof-review-rules";
import { Link } from "@tanstack/react-router";

/** Office review queue: approve (gives delivery) or reject receipt photos sent by drivers. */
export function ComprovantesPendentes() {
  const { data: list = [], error, isPending } = useQuery({
    queryKey: ["comprovantes-pendentes"],
    queryFn: async () => {
      const result = await supabase.from("comprovantes").select("*, motoristas:motorista_id(nome), notas_fiscais:nota_id(numero,cliente), cargas:carga_id(numero)").in("status", PENDING_PROOF_STATUSES).order("capturado_em");
      if (result.error) throw result.error;
      return (result.data ?? []).filter(c => isAwaitingProofReview(c) && !(c.triagem === "analisado" && c.tipo_documento !== "canhoto"));
    },
    refetchInterval: 30000,
  });
  const [open, setOpen] = useState<any>(null);
  return (
    <div className="mt-6">
      <h2 className="text-base font-bold mb-2">Comprovantes pendentes ({list.length})</h2>
      <div className="bg-card border rounded-md overflow-x-auto">
        <table className="table-erp">
          <thead><tr><th>Enviado</th><th>Motorista</th><th>Carga</th><th>NF identificada</th><th>Tipo sugerido</th><th>Leitura</th><th></th></tr></thead>
          <tbody>
            {list.map((c: any) => (
              <tr key={c.id}>
                <td>{fmtDateTime(c.capturado_em)}</td>
                <td>{c.motoristas?.nome}</td>
                <td>{c.cargas?.numero ? `#${c.cargas.numero}` : "—"}</td>
                <td>{c.notas_fiscais ? `${c.notas_fiscais.numero} • ${c.notas_fiscais.cliente}` : "—"}</td>
                <td>{PROOF_TYPES[c.tipo_documento] ?? "Não identificado"}</td>
                <td className="text-xs">{c.status === "pendente" ? "Lendo..." : c.status === "identificado" ? `Identificada (${c.reconhecimento?.criterio})` : c.reconhecimento?.motivo ?? c.reconhecimento?.erro ?? "Conferir"}</td>
                <td><Button size="sm" className="h-7 text-xs" onClick={() => setOpen(c)}>Conferir</Button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">{error ? "Não foi possível carregar os comprovantes" : isPending ? "Carregando comprovantes..." : "Nenhum comprovante aguardando"}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <Review c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Review({ c, onClose }: { c: any; onClose: () => void }) {
  const qc = useQueryClient();
  const recognize = useServerFn(reconhecerComprovante);
  const [url, setUrl] = useState<string>();
  const [photoError, setPhotoError] = useState(false);
  const [tipo, setTipo] = useState<string>(c.tipo_documento);
  const [savedTipo, setSavedTipo] = useState<string>(c.tipo_documento);
  const [nota, setNota] = useState<string>(c.nota_id ?? c.reconhecimento?.nota_sugerida ?? "");
  const [quando, setQuando] = useState(() => new Date(c.capturado_em).toISOString().slice(0, 16));
  const [motivo, setMotivo] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.storage.from("comprovantes").createSignedUrl(c.storage_path, 600).then(({ data, error }) => {
      if (!active) return;
      setUrl(data?.signedUrl);
      setPhotoError(!!error || !data?.signedUrl);
    });
    return () => { active = false; };
  }, [c.storage_path]);
  const { data: notas = [], error: notasError } = useQuery({
    queryKey: ["notas-motorista", c.motorista_id, tipo === "devolucao"],
    queryFn: async () => {
      let q = supabase.from("notas_fiscais").select("id,numero,cliente,status,cargas:carga_id!inner(numero,motorista_id,situacao)").eq("cargas.motorista_id", c.motorista_id);
      if (tipo !== "devolucao") q = q.eq("cargas.situacao", "ativa").neq("status", "entregue");
      const result = await q.order("numero");
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const classificar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("triar_documento", { _id: c.id, _tipo: tipo, _situacao: "analisado", _obs: c.observacoes_documento ?? "", ...(nota ? { _nota: nota } : {}) });
      if (error) throw error;
      return tipo;
    },
    onSuccess: (saved) => { setSavedTipo(saved); qc.invalidateQueries({ queryKey: ["comprovantes-pendentes"] }); qc.invalidateQueries({ queryKey: ["complementares"] }); toast.success("Classificação confirmada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const done = () => { qc.invalidateQueries(); onClose(); };
  const aprovar = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("aprovar_comprovante", { _id: c.id, _nota: nota, _data_entrega: new Date(quando).toISOString() }); if (error) throw error; },
    onSuccess: () => { toast.success("Entrega aprovada"); done(); }, onError: (e: any) => toast.error(e.message),
  });
  const rejeitar = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("rejeitar_comprovante", { _id: c.id, _motivo: motivo }); if (error) throw error; },
    onSuccess: () => { toast.success("Comprovante rejeitado"); done(); }, onError: (e: any) => toast.error(e.message),
  });
  const reler = useMutation({ mutationFn: () => recognize({ data: { id: c.id } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["comprovantes-pendentes"] }); toast.success("Leitura refeita"); onClose(); } });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conferir documento — {c.motoristas?.nome}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div>{url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto enviada pelo motorista" onError={() => setPhotoError(true)} className="w-full max-h-[60vh] object-contain border rounded" /></a> : !photoError && <div className="text-sm text-muted-foreground">Carregando foto...</div>}{photoError && <p className="text-sm text-destructive">Não foi possível carregar a foto. Feche e abra a conferência para tentar novamente.</p>}</div>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Leitura automática: chave {c.reconhecimento?.chave ?? "—"} • NF {c.reconhecimento?.numero ?? "—"} • série {c.reconhecimento?.serie ?? "—"}</div>
            <div className="space-y-1"><Label>Classificação do documento</Label>
              <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROOF_TYPES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
              <Button variant="outline" size="sm" disabled={classificar.isPending || aprovar.isPending || rejeitar.isPending} onClick={() => classificar.mutate()}>Confirmar classificação</Button>
            </div>
            <div className="space-y-1"><Label className="text-xs">Nota fiscal</Label>
              <Select value={nota} onValueChange={setNota}>
                <SelectTrigger><SelectValue placeholder="Selecione a NF" /></SelectTrigger>
                <SelectContent>
                  {c.nota_id && !notas.some((n: any) => n.id === c.nota_id) && <SelectItem value={c.nota_id}>NF {c.notas_fiscais?.numero}</SelectItem>}
                  {notas.map((n: any) => <SelectItem key={n.id} value={n.id}>NF {n.numero} • {n.cliente} (carga #{n.cargas?.numero})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {notasError && <p className="text-sm text-destructive">Não foi possível carregar as notas deste motorista.</p>}
            <div className="space-y-1"><Label className="text-xs">Data da entrega</Label><Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></div>
            {rejecting && <div className="space-y-1"><Label className="text-xs">Motivo da rejeição (obrigatório)</Label><Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>}
            <Button variant="link" size="sm" className="px-0" onClick={() => reler.mutate()} disabled={reler.isPending}>Refazer leitura automática</Button>
            {savedTipo === "devolucao" && <Button variant="outline" asChild><Link to="/notas-devolucao">Tratar nota de devolução</Link></Button>}
          </div>
        </div>
        <DialogFooter>
          {rejecting
            ? <Button variant="destructive" disabled={motivo.trim().length < 3 || rejeitar.isPending} onClick={() => rejeitar.mutate()}>Confirmar rejeição</Button>
            : <Button variant="outline" onClick={() => setRejecting(true)}>Rejeitar</Button>}
          <Button disabled={!nota || savedTipo !== "canhoto" || tipo !== savedTipo || classificar.isPending || aprovar.isPending || rejeitar.isPending || photoError || !url} onClick={() => aprovar.mutate()}>Aprovar entrega</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
