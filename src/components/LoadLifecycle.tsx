import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Trash2, Ban, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LOAD_STATE_LABEL, validateLoadAction, type LoadAction, type LoadInspection, type LoadKind } from "@/lib/load-lifecycle";
import { CARGA_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { ENTRADA_STATUS_LABEL } from "@/lib/agenda";
import { toast } from "sonner";

const actions = { excluir: "Excluir carga", cancelar: "Cancelar carga", arquivar: "Arquivar carga" };
export function LoadStateFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Situação das cargas" className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as situações</SelectItem>{Object.entries(LOAD_STATE_LABEL).map(([key, label]) => <SelectItem key={key} value={key}>{label === "Ativa" ? "Ativas" : label === "Cancelada" ? "Canceladas" : label === "Arquivada" ? "Arquivadas" : "Excluídas"}</SelectItem>)}</SelectContent></Select>;
}
export function LoadStateInfo({ load }: { load: { situacao: string; situacao_motivo: string | null; situacao_em: string | null } }) {
  if (load.situacao === "ativa") return null;
  return <div className="border-y py-3 text-sm space-y-1"><p className="font-semibold">{LOAD_STATE_LABEL[load.situacao]} · {fmtDateTime(load.situacao_em)}</p><p>{load.situacao_motivo}</p></div>;
}
export function LoadLifecycleActions({ id, kind, state, onDone }: { id: string; kind: LoadKind; state: string; onDone?: () => void }) {
  const { canWrite } = useAuth();
  const [action, setAction] = useState<LoadAction | null>(null);
  if (!canWrite || state === "excluida") return null;
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" className="h-8 w-8" aria-label="Ações da carga" title="Ações da carga"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {state === "ativa" && <DropdownMenuItem onSelect={() => setAction("cancelar")}><Ban className="h-4 w-4" />Cancelar carga</DropdownMenuItem>}
      {state !== "arquivada" && <DropdownMenuItem onSelect={() => setAction("arquivar")}><Archive className="h-4 w-4" />Arquivar carga</DropdownMenuItem>}
      <DropdownMenuItem className="text-destructive" onSelect={() => setAction("excluir")}><Trash2 className="h-4 w-4" />Excluir carga</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    {action && <LoadActionDialog id={id} kind={kind} action={action} onClose={() => setAction(null)} onDone={onDone} />}
  </>;
}
function LoadActionDialog({ id, kind, action, onClose, onDone }: { id: string; kind: LoadKind; action: LoadAction; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const inspect = useQuery({ queryKey: ["load-inspection", kind, id], staleTime: 0, queryFn: async () => {
    const result = await supabase.rpc("inspecionar_carga", { _tipo: kind, _id: id });
    if (result.error) throw result.error;
    return result.data as unknown as LoadInspection;
  } });
  const mutation = useMutation({ mutationFn: async () => {
    if (!inspect.data || !confirmed) throw new Error("Confirme a ação antes de continuar");
    validateLoadAction(action, reason, inspect.data);
    const result = await supabase.rpc("alterar_situacao_carga", { _tipo: kind, _id: id, _acao: action, _motivo: reason });
    if (result.error) throw result.error;
  }, onSuccess: () => { qc.invalidateQueries(); toast.success(action === "excluir" ? "Carga excluída da operação; registros preservados" : action === "cancelar" ? "Carga cancelada" : "Carga arquivada"); onClose(); onDone?.(); }, onError: (e: Error) => { toast.error(e.message); inspect.refetch(); } });
  const blocked = action === "excluir" && inspect.data && !inspect.data.pode_excluir;
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{actions[action]}</DialogTitle></DialogHeader>
    {inspect.isPending && <p>Verificando vínculos...</p>}
    {inspect.error && <p role="alert" className="text-destructive">Não foi possível verificar os vínculos. <Button variant="outline" size="sm" onClick={() => inspect.refetch()}>Tentar novamente</Button></p>}
    {inspect.data && <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-2"><dt>Carga</dt><dd className="font-semibold">{inspect.data.numero || "Sem número"}</dd><dt>Notas vinculadas</dt><dd>{inspect.data.notas}</dd><dt>Status operacional</dt><dd>{(kind === "entrada" ? ENTRADA_STATUS_LABEL : CARGA_STATUS_LABEL)[inspect.data.status] || inspect.data.status}</dd><dt>Situação</dt><dd>{LOAD_STATE_LABEL[inspect.data.situacao]}</dd></dl>
      {blocked ? <div role="alert" className="border border-destructive/40 bg-destructive/10 p-3"><p className="font-semibold">Exclusão bloqueada</p><ul className="list-disc pl-5">{inspect.data.bloqueios.map(b => <li key={b}>{b}</li>)}</ul><p className="mt-2">Utilize Cancelar carga ou Arquivar carga. Notas e histórico devem permanecer preservados.</p></div> : <>
        <p>{action === "excluir" ? "A carga sairá da operação e permanecerá consultável em Excluídas. Nenhuma nota fiscal, documento ou histórico será apagado." : "A carga sairá da lista de ativas. Notas, ocorrências, documentos e histórico permanecerão vinculados e consultáveis. Esta ação não desfaz recebimentos nem entregas."}</p>
        <div className="space-y-1"><Label htmlFor="load-action-reason">Justificativa</Label><Textarea id="load-action-reason" value={reason} onChange={e => setReason(e.target.value)} disabled={mutation.isPending} /></div>
        <label className="flex items-start gap-2"><Checkbox aria-label="Confirmar ação da carga" checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} disabled={mutation.isPending} /><span>Confirmo {action === "excluir" ? "a exclusão" : action === "cancelar" ? "o cancelamento" : "o arquivamento"} da carga {inspect.data.numero}.</span></label>
      </>}
    </div>}
    <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>Voltar</Button><Button variant={action === "excluir" ? "destructive" : "default"} disabled={!inspect.data || !!inspect.error || !!blocked || !reason.trim() || !confirmed || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Salvando..." : actions[action]}</Button></DialogFooter>
  </DialogContent></Dialog>;
}