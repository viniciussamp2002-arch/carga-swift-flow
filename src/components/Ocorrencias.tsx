import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { OC_TIPO_LABEL, OC_STATUS_LABEL, OC_ETAPA_LABEL, occurrenceState, occurrenceOrigin, validateOccurrenceUpdate } from "@/lib/occurrence-rules";
import { toast } from "sonner";
import { AlertTriangle, Paperclip, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
export { OC_TIPO_LABEL, OC_STATUS_LABEL } from "@/lib/occurrence-rules";
type Occurrence = Database["public"]["Tables"]["ocorrencias"]["Row"];
type Nota = { id: string; numero?: string; chave_nfe?: string | null; carga_entrada_id?: string | null; carga_id?: string | null; cliente?: string; fornecedor?: string };

export function useOcorrencias() {
  const { canWrite } = useAuth();
  const { data = [] } = useQuery({ queryKey: ["ocorrencias"], enabled: canWrite, queryFn: async () => {
    const all: Occurrence[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("ocorrencias").select("*").order("data_ocorrencia", { ascending: false }).order("id").range(from, from + 999);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return all;
  }});
  return useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of data) map.set(o.nota_id, [...(map.get(o.nota_id) ?? []), o]);
    return map;
  }, [data]);
}

export function OcorrenciaGrupoBadge({ notas }: { notas: Nota[] }) {
  const map = useOcorrencias();
  const affected = notas.filter(n => map.has(n.id));
  if (!affected.length) return null;
  return <span className="inline-flex flex-wrap gap-1 ml-2">{affected.map(n => <OcorrenciaBadge key={n.id} nota={n} showNumber />)}</span>;
}

export function OcorrenciaBadge({ nota, showNumber = false, allowCreate = false, etapa = "recebimento" }: { nota: Nota; showNumber?: boolean; allowCreate?: boolean; etapa?: string }) {
  const map = useOcorrencias();
  const { canWrite } = useAuth();
  const [open, setOpen] = useState(false);
  const [create, setCreate] = useState(false);
  const list = map.get(nota.id) ?? [];
  if (!list.length && !(allowCreate && canWrite)) return null;
  const pending = list.some(o => o.status !== "resolvida");
  return <>
    <Button type="button" variant="outline" size="sm" onClick={e => { e.stopPropagation(); list.length ? setOpen(true) : setCreate(true); }}
      title={occurrenceState(list)} className={`h-auto min-h-6 py-0.5 px-1 text-[10px] ml-1 ${pending ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted text-muted-foreground"}`}>
      {list.length ? <AlertTriangle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{showNumber ? `NF ${nota.numero} · ` : ""}{list.length ? `Ocorrência${list.length > 1 ? ` (${list.length})` : ""}` : "Registrar ocorrência"}
    </Button>
    {open && <OcorrenciasDetalhe nota={nota} list={list} etapa={etapa} onClose={() => setOpen(false)} />}
    {create && <RegistrarOcorrencia nota={nota} etapa={etapa} onClose={() => setCreate(false)} />}
  </>;
}

function OccurrenceItem({ o }: { o: Occurrence }) {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState(o.status);
  const [resolucao, setResolucao] = useState(o.resolucao);
  const [observacao, setObservacao] = useState("");
  const { data: events = [], isPending, error } = useQuery({ queryKey: ["ocorrencia-eventos", o.id], queryFn: async () => {
    const all: Database["public"]["Tables"]["ocorrencia_eventos"]["Row"][] = [];
    for (let from = 0; ; from += 1000) {
      const result = await supabase.from("ocorrencia_eventos").select("*").eq("ocorrencia_id", o.id).order("created_at").order("id").range(from, from + 999);
      if (result.error) throw result.error;
      all.push(...(result.data ?? []));
      if (!result.data || result.data.length < 1000) break;
    }
    return all;
  }});
  const update = useMutation({ mutationFn: async () => {
    validateOccurrenceUpdate(status, resolucao);
    const { error } = await supabase.from("ocorrencias").update({ status, resolucao: resolucao.trim(), observacao_posterior: observacao.trim() }).eq("id", o.id).select("id").single();
    if (error) throw error;
  }, onSuccess: () => { setObservacao(""); qc.invalidateQueries({ queryKey: ["ocorrencias"] }); qc.invalidateQueries({ queryKey: ["ocorrencia-eventos", o.id] }); qc.invalidateQueries({ queryKey: ["historico"] }); toast.success("Ocorrência atualizada"); }, onError: (e: Error) => toast.error(e.message) });
  async function attachment() {
    if (!o.anexo_path) return;
    const { data, error } = await supabase.storage.from("ocorrencias").createSignedUrl(o.anexo_path, 300);
    if (error) toast.error(error.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return <section className="border-b pb-4 space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-sm"><b>{OC_TIPO_LABEL[o.tipo]}</b><span>{OC_ETAPA_LABEL[o.etapa]}</span><span className="ml-auto">{OC_STATUS_LABEL[o.status]}</span></div>
    {o.quantidade != null && <p className="text-sm">{fmtNum(o.quantidade)} {o.unidade}</p>}
    <p className="text-sm whitespace-pre-wrap break-words">{o.descricao}</p>
    <p className="text-xs text-muted-foreground">{fmtDateTime(o.data_ocorrencia)} · {o.registrado_por_nome || "—"}</p>
    {o.anexo_path && <Button variant="link" size="sm" onClick={attachment}><Paperclip className="h-3 w-3" />Anexo</Button>}
    {o.resolvida_em && <p className="text-xs">Resolvida em {fmtDateTime(o.resolvida_em)}</p>}
    <div className="space-y-1"><h3 className="text-sm font-semibold">Histórico</h3>
      {isPending && <p className="text-xs">Carregando histórico...</p>}{error && <p className="text-destructive text-xs">Não foi possível carregar o histórico.</p>}
      {events.map(event => { const state = event.atual as Record<string, unknown>; return <div key={event.id} className="text-xs border-l-2 pl-2 py-1">
        <p className="text-muted-foreground">{fmtDateTime(event.created_at)} · {event.usuario_nome || event.usuario_id || "Registro anterior"} · {event.acao}</p>
        <p>{OC_STATUS_LABEL[String(state.status)]} {state.resolucao ? `· Solução: ${state.resolucao}` : ""}</p>
        {state.observacao_posterior ? <p className="whitespace-pre-wrap break-words">{String(state.observacao_posterior)}</p> : null}
      </div>; })}
    </div>
    {canWrite && <div className="space-y-2">
      <Label>Status</Label><Select value={status} onValueChange={v => setStatus(v as Occurrence["status"])}><SelectTrigger aria-label="Status da ocorrência"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(OC_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor={`solution-${o.id}`}>Solução adotada</Label><Textarea id={`solution-${o.id}`} value={resolucao} onChange={e => setResolucao(e.target.value)} />
      <Label htmlFor={`note-${o.id}`}>Nova observação</Label><Textarea id={`note-${o.id}`} value={observacao} onChange={e => setObservacao(e.target.value)} />
      <Button size="sm" disabled={update.isPending || (status === "resolvida" && !resolucao.trim()) || (status === o.status && resolucao === o.resolucao && !observacao.trim())} onClick={() => update.mutate()}>Salvar atualização</Button>
    </div>}
  </section>;
}

function OcorrenciasDetalhe({ nota, list, etapa, onClose }: { nota: Nota; list: Occurrence[]; etapa: string; onClose: () => void }) {
  const { canWrite } = useAuth();
  const [create, setCreate] = useState(false);
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-w-2xl" onClick={e => e.stopPropagation()}>
    <DialogHeader><DialogTitle>Ocorrências — NF {nota.numero}</DialogTitle></DialogHeader>
    <div className="space-y-4 max-h-[65vh] overflow-auto">{list.map(o => <OccurrenceItem key={o.id} o={o} />)}</div>
    {canWrite && <DialogFooter><Button variant="outline" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Registrar ocorrência</Button></DialogFooter>}
    {create && <RegistrarOcorrencia nota={nota} etapa={etapa} onClose={() => setCreate(false)} />}
  </DialogContent></Dialog>;
}

export function RegistrarOcorrencia({ nota, transporte, cargaEntradaId, etapa = "recebimento", onClose }: { nota: Nota; transporte?: string; cargaEntradaId?: string; etapa?: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const idRef = useRef(crypto.randomUUID());
  const uploaded = useRef<string | null>(null);
  const agora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  const [f, setF] = useState({ tipo: "falta", etapa, quantidade: "", unidade: "", descricao: "", quando: agora });
  const [file, setFile] = useState<File | null>(null);
  const mut = useMutation({ mutationFn: async () => {
    if (!user) throw new Error("Entre novamente para registrar a ocorrência");
    if (f.quantidade && (!Number.isFinite(Number(f.quantidade)) || Number(f.quantidade) < 0)) throw new Error("Quantidade inválida");
    if (file && !uploaded.current) {
      const path = `${nota.id}/${idRef.current}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("ocorrencias").upload(path, file);
      if (up.error) throw up.error;
      uploaded.current = path;
    }
    const { error } = await supabase.from("ocorrencias").insert({ id: idRef.current, origem: occurrenceOrigin(f.etapa), etapa: f.etapa, nota_id: nota.id,
      chave_nfe: nota.chave_nfe, carga_entrada_id: cargaEntradaId ?? nota.carga_entrada_id, carga_id: nota.carga_id,
      tipo: f.tipo as Occurrence["tipo"], quantidade: f.quantidade === "" ? null : Number(f.quantidade), unidade: f.unidade || null,
      descricao: f.descricao, data_ocorrencia: new Date(f.quando).toISOString(), anexo_path: uploaded.current });
    if (error) {
      if (error.code !== "23505") throw error;
      const retry = await supabase.from("ocorrencias").select("id").eq("id", idRef.current).eq("nota_id", nota.id).single();
      if (retry.error) throw error;
    }
  }, onSuccess: () => { toast.success("Ocorrência registrada"); qc.invalidateQueries({ queryKey: ["ocorrencias"] }); qc.invalidateQueries({ queryKey: ["historico"] }); onClose(); }, onError: (e: Error) => toast.error(e.message) });
  return <Dialog open onOpenChange={o => !o && !mut.isPending && onClose()}><DialogContent className="max-w-lg max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Registrar ocorrência</DialogTitle></DialogHeader>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Nota fiscal"><Input value={nota.numero ?? ""} disabled /></Field><Field label="Transporte"><Input value={transporte ?? ""} disabled /></Field>
      <Field label="Cliente"><Input value={nota.cliente ?? ""} disabled /></Field><Field label="Fornecedor"><Input value={nota.fornecedor ?? ""} disabled /></Field>
      <Field label="Etapa"><Select value={f.etapa} onValueChange={v => setF({ ...f, etapa: v })}><SelectTrigger aria-label="Etapa da operação"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(OC_ETAPA_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Tipo"><Select value={f.tipo} onValueChange={v => setF({ ...f, tipo: v })}><SelectTrigger aria-label="Tipo de ocorrência"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(OC_TIPO_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Data e horário"><Input aria-label="Data e horário" type="datetime-local" value={f.quando} onChange={e => setF({ ...f, quando: e.target.value })} /></Field>
      <Field label="Quantidade afetada"><Input aria-label="Quantidade afetada" type="number" min="0" step="any" value={f.quantidade} onChange={e => setF({ ...f, quantidade: e.target.value })} /></Field>
      <Field label="Unidade"><Input aria-label="Unidade" value={f.unidade} onChange={e => setF({ ...f, unidade: e.target.value })} /></Field>
      <Field label="Descrição"><Textarea aria-label="Descrição" value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} /></Field>
      <Field label="Responsável"><Input value={user?.email ?? ""} disabled /></Field>
      <Field label="Foto / documento"><Input type="file" accept="image/*,.pdf" disabled={mut.isPending || !!uploaded.current} onChange={e => setFile(e.target.files?.[0] ?? null)} /></Field>
    </div><DialogFooter><Button variant="outline" disabled={mut.isPending} onClick={onClose}>Cancelar</Button><Button disabled={mut.isPending || !f.quando} onClick={() => mut.mutate()}>{mut.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1 min-w-0"><Label>{label}</Label>{children}</div>; }
