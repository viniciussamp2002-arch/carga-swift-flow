import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OcorrenciaBadge, useOcorrencias } from "@/components/Ocorrencias";
import { CHECK_QUESTIONS, initialReceivingData, unloadingCost, validateChecklist, type Answer, type ReceivingData, type ReceivingLoad, type ReceivingNote } from "@/lib/receiving-rules";
import { receivingPdf } from "@/lib/receiving-pdf";
import { fmtBRL, fmtNum, fmtDateTime } from "@/lib/format";
import type { Database, Json } from "@/integrations/supabase/types";
import { Download, Eye, Printer, Save } from "lucide-react";
import { toast } from "sonner";

type Document = Database["public"]["Tables"]["documentos_recebimento"]["Row"];
export function useReceivingChecklist(id: string) {
  return useQuery({queryKey:["checklist",id],queryFn:async()=>{
    const r=await supabase.from("checklists_recebimento").select("*").eq("carga_entrada_id",id).maybeSingle();
    if(r.error)throw r.error;return r.data;
  }});
}
export function useReceivingDocuments(id: string) {
  return useQuery({queryKey:["receiving-documents",id],queryFn:async()=>{
    const all: Document[]=[];
    for(let from=0;;from+=1000){const r=await supabase.from("documentos_recebimento").select("*").eq("carga_entrada_id",id).order("created_at",{ascending:false}).order("id").range(from,from+999);if(r.error)throw r.error;all.push(...(r.data??[]));if(!r.data||r.data.length<1000)break;}
    return all;
  }});
}

export function ReceivingDocuments({load,notes,kind,readOnly=false}:{load:ReceivingLoad;notes:ReceivingNote[];kind:"checklist"|"recibo";readOnly?:boolean}) {
  const checklist=useReceivingChecklist(load.id);
  if(checklist.isPending) return <p className="text-sm py-4">Carregando conferência...</p>;
  if(checklist.error) return <p role="alert" className="text-destructive">Não foi possível carregar a conferência.</p>;
  return <ReceivingForm key={`${load.id}-${kind}-${readOnly}`} load={load} notes={notes} kind={kind} readOnly={readOnly} saved={checklist.data?.dados as unknown as ReceivingData | undefined} />;
}

function ReceivingForm({load,notes,kind,saved,readOnly}:{load:ReceivingLoad;notes:ReceivingNote[];kind:"checklist"|"recibo";saved?:ReceivingData;readOnly:boolean}) {
  const {user,canWrite:authorized}=useAuth();
  const canWrite=authorized&&!readOnly;
  const qc=useQueryClient();
  const defaults=initialReceivingData(load,notes,user?.email||"");
  const [form,setForm]=useState<ReceivingData>(()=>kind==="checklist"&&saved?{...defaults,...saved,peso_kg:defaults.peso_kg,volumes_previstos:defaults.volumes_previstos,notas:defaults.notas,fornecedores:defaults.fornecedores}:defaults);
  const [preview,setPreview]=useState<{url:string;name:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [savedVersion,setSavedVersion]=useState<number|null>(null);
  const receiptRequest=useRef<string|null>(null);
  const frame=useRef<HTMLIFrameElement>(null);
  const versions=useReceivingDocuments(load.id);
  const cost=unloadingCost(Number.isFinite(form.peso_kg)&&form.peso_kg>=0?form.peso_kg:0,Number.isFinite(form.tarifa)&&form.tarifa>=0?form.tarifa:0);
  function change<K extends keyof ReceivingData>(key:K,value:ReceivingData[K]) {setForm(f=>({...f,[key]:value}));setDirty(true);receiptRequest.current=null;}
  async function snapshot():Promise<ReceivingData> {
    const occurrences: ReceivingData["ocorrencias"] = [];
    const byId = new Map(notes.map(n => [n.id,n]));
    const ids = notes.map(n=>n.id);
    for(let start=0;start<ids.length;start+=100) for(let from=0;;from+=1000) {
      const result=await supabase.from("ocorrencias").select("*").in("nota_id",ids.slice(start,start+100)).order("data_ocorrencia").order("id").range(from,from+999);
      if(result.error)throw result.error;
      for(const o of result.data||[]) occurrences.push({numero:byId.get(o.nota_id)?.numero||"",tipo:o.tipo,descricao:o.descricao,status:o.status,quantidade:o.quantidade,unidade:o.unidade});
      if(!result.data||result.data.length<1000)break;
    }
    return {...form,...unloadingCost(form.peso_kg,form.tarifa),empresa:defaults.empresa,notas:defaults.notas,fornecedores:defaults.fornecedores,ocorrencias:occurrences};
  }
  const save=useMutation({mutationFn:async()=>{
    const data=await snapshot();validateChecklist(data);
    const r=await supabase.from("checklists_recebimento").upsert({carga_entrada_id:load.id,dados:data as unknown as Json},{onConflict:"carga_entrada_id"}).select().single();
    if(r.error)throw r.error;return r.data;
  },onSuccess:r=>{setDirty(false);setSavedVersion(r.versao);qc.invalidateQueries({queryKey:["checklist",load.id]});qc.invalidateQueries({queryKey:["receiving-documents",load.id]});qc.invalidateQueries({queryKey:["receiving-history",load.id]});toast.success("Checklist salvo");},onError:(e:Error)=>toast.error(e.message)});

  async function display(data:ReceivingData,version:number,responsible:string,issued:string,download=false) {
    const blob=await receivingPdf(data,kind,version,responsible,issued);
    const url=URL.createObjectURL(blob);const name=`${kind}-${data.transporte||load.id}-v${version}.pdf`;
    if(download){const a=document.createElement("a");a.href=url;a.download=name;a.click();}
    if(preview)URL.revokeObjectURL(preview.url);setPreview({url,name});
  }
  async function generate(emit:boolean,download=false) {
    setBusy(true);
    try {
      if(kind==="checklist") {
        if(dirty)throw new Error("Salve o checklist antes de gerar o documento");
        const saved=await supabase.from("documentos_recebimento").select("*").eq("carga_entrada_id",load.id).eq("tipo","checklist").order("versao",{ascending:false}).limit(1).single();
        if(saved.error)throw new Error("Salve o checklist antes de gerar o documento");
        await display(saved.data.dados as unknown as ReceivingData,saved.data.versao,saved.data.registrado_por_nome||"",saved.data.created_at,download);
      } else {
        if(!form.data||!form.conferente.trim())throw new Error("Informe a data do recebimento e o conferente");
        let data=await snapshot(),version=0,responsible=user?.email||"",issued=new Date().toISOString();
        if(emit){
          const id=receiptRequest.current||crypto.randomUUID();receiptRequest.current=id;
          const r=await supabase.from("documentos_recebimento").insert({id,carga_entrada_id:load.id,tipo:"recibo",dados:data as unknown as Json}).select().single();
          let document=r.data;
          if(r.error){if(r.error.code!=="23505")throw r.error;const existing=await supabase.from("documentos_recebimento").select("*").eq("id",id).single();if(existing.error)throw existing.error;document=existing.data;}
          if(!document)throw new Error("Não foi possível emitir o recibo");
          data=document.dados as unknown as ReceivingData;version=document.versao;responsible=document.registrado_por_nome||"";issued=document.created_at;
          setSavedVersion(version);setDirty(false);receiptRequest.current=null;
          qc.invalidateQueries({queryKey:["receiving-documents",load.id]});qc.invalidateQueries({queryKey:["receiving-history",load.id]});toast.success(`Recibo emitido — versão ${version}`);
        }
        await display(data,version,responsible,issued,download);
      }
    } catch(e){toast.error(e instanceof Error?e.message:"Não foi possível gerar o PDF");}finally{setBusy(false);}
  }
  async function historical(doc:Document){setBusy(true);try{await display(doc.dados as unknown as ReceivingData,doc.versao,doc.registrado_por_nome||"",doc.created_at);}catch(e){toast.error(e instanceof Error?e.message:"Erro ao abrir documento");}finally{setBusy(false);}}
  const txt=(key:"motorista"|"placa"|"reboque"|"conferente"|"transporte"|"transportadora"|"numero_lacre"|"condicoes_veiculo",label:string)=><Field label={label}><Input aria-label={label} value={form[key]} disabled={!canWrite} onChange={e=>change(key,e.target.value)} /></Field>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{kind==="checklist"?"Checklist de Recebimento":"Recibo de Descarga"}</h2><span className="text-xs text-muted-foreground">{dirty?"Alterações não salvas":savedVersion?`Versão ${savedVersion} salva`:saved&&kind==="checklist"?"Checklist salvo":""}</span></div>
    <p className="text-sm"><b>Fornecedores:</b> {defaults.fornecedores.join(" · ")||"—"}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {txt("transporte","Número do transporte")}{txt("transportadora","Transportadora")}{txt("motorista","Motorista")}{txt("placa","Placa do veículo")}{txt("reboque","Placa do reboque")}{txt("conferente","Conferente")}
      <Field label={kind==="checklist"?"Data da conferência":"Data do recebimento"}><Input aria-label={kind==="checklist"?"Data da conferência":"Data do recebimento"} type="datetime-local" disabled={!canWrite} value={toLocal(form.data)} onChange={e=>change("data",e.target.value?new Date(e.target.value).toISOString():"")} /></Field>
      <Field label="Peso total (kg)"><Input aria-label="Peso total (kg)" type="number" step="0.001" min="0" disabled={!canWrite||kind==="checklist"} value={form.peso_kg} onChange={e=>change("peso_kg",Number(e.target.value))} /></Field>
      <Field label="Volumes previstos"><Input aria-label="Volumes previstos" type="number" min="0" step="1" disabled={!canWrite||kind==="checklist"} value={form.volumes_previstos} onChange={e=>change("volumes_previstos",Number(e.target.value))} /></Field>
    </div>
    {kind==="checklist"?<>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(CHECK_QUESTIONS).map(([key,label])=><Field key={key} label={label}><Select value={form.respostas[key]||"pendente"} disabled={!canWrite} onValueChange={v=>change("respostas",{...form.respostas,[key]:v as Answer})}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendente" disabled>Não informado</SelectItem><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem><SelectItem value="na">Não se aplica</SelectItem></SelectContent></Select></Field>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{txt("numero_lacre","Número do lacre")}{txt("condicoes_veiculo","Condições gerais do veículo")}<Field label="Volumes recebidos"><Input aria-label="Volumes recebidos" type="number" min="0" step="1" value={form.volumes_recebidos??""} disabled={!canWrite} onChange={e=>change("volumes_recebidos",e.target.value===""?null:Number(e.target.value))} /></Field></div>
    </>:<>
      <div className="flex flex-wrap items-end gap-5 border-y py-3"><Field label="Tarifa por tonelada (R$)"><Input aria-label="Tarifa por tonelada (R$)" className="w-48" type="number" min="0" step="0.01" value={form.tarifa} disabled={!canWrite} onChange={e=>change("tarifa",Number(e.target.value))} /></Field><p className="text-sm">Toneladas <b>{fmtNum(cost.toneladas,3)} t</b></p><p className="text-lg">Total <b>{fmtBRL(cost.valor_total)}</b></p></div>
    </>}
    <Field label="Observações"><Textarea aria-label="Observações do documento" disabled={!canWrite} value={form.observacoes} onChange={e=>change("observacoes",e.target.value)} /></Field>
    {kind==="checklist"&&<ReceivingOccurrences notes={notes} etapa="conferencia" />}
    <div className="flex flex-wrap gap-2">
      {kind==="checklist"&&canWrite&&<Button size="sm" disabled={save.isPending} onClick={()=>save.mutate()}><Save className="h-4 w-4" />Salvar Checklist</Button>}
      <Button size="sm" variant="outline" disabled={busy} onClick={()=>generate(false)}><Eye className="h-4 w-4" />{kind==="recibo"?"Visualizar recibo":"Visualizar checklist"}</Button>
      {(kind==="checklist"||canWrite)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>generate(kind==="recibo",true)}><Download className="h-4 w-4" />Gerar PDF</Button>}
      {(kind==="checklist"||canWrite)&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>generate(kind==="recibo")}><Printer className="h-4 w-4" />Imprimir</Button>}
    </div>
    <div className="border-t pt-3 space-y-2"><h3 className="font-semibold text-sm">{kind==="recibo"?"Recibos emitidos":"Versões do checklist"}</h3>
      {versions.error&&<p className="text-destructive text-sm">Não foi possível carregar versões anteriores.</p>}
      {(versions.data||[]).filter(d=>d.tipo===kind).map(doc=><div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-xs" key={doc.id}><span>Versão {doc.versao} · {fmtDateTime(doc.created_at)} · {doc.registrado_por_nome||"—"}</span><Button size="sm" variant="ghost" disabled={busy} onClick={()=>historical(doc)}><Eye className="h-3 w-3" />Consultar</Button></div>)}
    </div>
    {preview&&<Dialog open onOpenChange={open=>{if(!open){URL.revokeObjectURL(preview.url);setPreview(null);}}}><DialogContent className="max-w-4xl max-h-[95vh]"><DialogHeader><DialogTitle>{preview.name}</DialogTitle></DialogHeader><iframe ref={frame} title="Documento PDF" src={preview.url} className="w-full h-[60vh] border" /><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{const a=document.createElement("a");a.href=preview.url;a.download=preview.name;a.click();}}><Download className="h-4 w-4" />Baixar</Button><Button size="sm" onClick={()=>{try{frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print();}catch{window.open(preview.url,"_blank","noopener,noreferrer");}}}><Printer className="h-4 w-4" />Imprimir documento</Button></div></DialogContent></Dialog>}
  </div>;
}
function toLocal(value:string){if(!value)return "";const d=new Date(value);return Number.isNaN(d.getTime())?"":new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>;}

export function ReceivingOccurrences({notes,etapa="recebimento"}:{notes:ReceivingNote[];etapa?:string}) {
  const map=useOcorrencias();
  return <div className="space-y-2"><h3 className="text-sm font-semibold">Ocorrências por nota fiscal</h3><div className="border rounded-md overflow-auto"><table className="table-erp"><thead><tr><th>NF</th><th>Fornecedor</th><th>Cliente</th><th>Ocorrências</th></tr></thead><tbody>{notes.map(n=><tr key={n.id}><td>{n.numero}</td><td>{n.fornecedor}</td><td>{n.cliente}</td><td><OcorrenciaBadge nota={n} allowCreate etapa={etapa} />{!map.has(n.id)&&<span className="text-xs text-muted-foreground ml-2">Sem ocorrência</span>}</td></tr>)}</tbody></table></div></div>;
}
export function ReceivingHistory({loadId,notes}:{loadId:string;notes:ReceivingNote[]}) {
  const {data=[],isPending,error}=useQuery({queryKey:["receiving-history",loadId],queryFn:async()=>{
    const ids=[loadId,...notes.map(n=>n.id)];const all: Database["public"]["Tables"]["historico"]["Row"][]=[];
    for(let start=0;start<ids.length;start+=100){for(let from=0;;from+=1000){const r=await supabase.from("historico").select("*").in("entidade_id",ids.slice(start,start+100)).order("created_at",{ascending:false}).order("id").range(from,from+999);if(r.error)throw r.error;all.push(...(r.data||[]));if(!r.data||r.data.length<1000)break;}}
    return all.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  }});
  return <div className="space-y-2"><h2 className="font-semibold">Histórico da carga</h2>{isPending&&<p>Carregando...</p>}{error&&<p className="text-destructive">Não foi possível carregar o histórico.</p>}{data.map(e=><div key={e.id} className="border-b py-2 text-sm"><p>{e.descricao}</p><p className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)} · {e.acao}</p></div>)}{!isPending&&!data.length&&<p className="text-sm text-muted-foreground">Nenhuma operação registrada.</p>}</div>;
}