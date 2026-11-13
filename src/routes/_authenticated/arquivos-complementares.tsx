import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/page-head";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
export const Route = createFileRoute("/_authenticated/arquivos-complementares")({ head: () => pageHead("Arquivos Complementares", "Triagem dos documentos enviados pelos motoristas."), component: Files });
const TYPES = { canhoto: "Canhoto de entrega", devolucao: "Nota de devolução", recibo: "Recibo de descarga", recusa: "Comprovante de recusa", outro: "Outro documento", nao_identificado: "Não identificado" };
function Files() {
  const [open, setOpen] = useState<any>(null);
  const { data = [], error } = useQuery({ queryKey: ["complementares"], queryFn: async () => { const r = await supabase.from("comprovantes").select("*,motoristas(nome),documento_vinculos(*,notas_fiscais(numero),cargas(numero))").neq("tipo_documento", "canhoto").order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data; } });
  return <div><PageHeader title="Arquivos Complementares" /><div className="overflow-auto"><table className="table-erp"><thead><tr><th>Documento</th><th>Motorista</th><th>Enviado</th><th>Tipo</th><th>Situação</th><th>Vínculos</th></tr></thead><tbody>{data.map(d => <tr key={d.id}><td><Button variant="outline" size="sm" onClick={() => setOpen(d)}>Visualizar / Analisar</Button></td><td>{d.motoristas?.nome}</td><td>{fmtDateTime(d.capturado_em)}</td><td>{TYPES[d.tipo_documento as keyof typeof TYPES]}</td><td>{d.triagem}</td><td>{d.documento_vinculos.map(v => v.notas_fiscais ? `NF ${v.notas_fiscais.numero}` : v.cargas ? `Carga ${v.cargas.numero}` : "Entrega").join(" • ")}</td></tr>)}{!data.length && <tr><td colSpan={6}>{error ? "Não foi possível carregar os documentos" : "Nenhum documento complementar"}</td></tr>}</tbody></table></div>{open && <Review d={open} close={() => setOpen(null)} />}</div>;
}
function Review({ d, close }: { d: any; close: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(d.tipo_documento);
  const [situacao, setSituacao] = useState(d.triagem);
  const [obs, setObs] = useState(d.observacoes_documento);
  const [nota, setNota] = useState("none");
  const [carga, setCarga] = useState("none");
  const [entrega, setEntrega] = useState("none");
  const [busy, setBusy] = useState(false);
  const { data: url } = useQuery({ queryKey: ["document-image", d.id], queryFn: async () => { const r = await supabase.storage.from("comprovantes").createSignedUrl(d.storage_path, 600); if (r.error) throw r.error; return r.data.signedUrl; } });
  const { data: ns = [] } = useQuery({ queryKey: ["document-notes"], queryFn: async () => (await supabase.from("notas_fiscais").select("id,numero,cliente")).data ?? [] });
  const { data: cs = [] } = useQuery({ queryKey: ["document-loads"], queryFn: async () => (await supabase.from("cargas").select("id,numero")).data ?? [] });
  const { data: es = [] } = useQuery({ queryKey: ["document-deliveries"], queryFn: async () => (await supabase.from("entregas").select("id,notas_fiscais(numero)")).data ?? [] });
  const selector = (label: string, value: string, change: (v: string) => void, items: { id: string; label: string }[]) => <div><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem vínculo</SelectItem>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}</SelectContent></Select></div>;
  return <Dialog open onOpenChange={close}><DialogContent className="max-w-3xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Analisar documento</DialogTitle></DialogHeader><div className="grid md:grid-cols-2 gap-4"><div>{url && <><img src={url} alt="Documento complementar" className="w-full max-h-96 object-contain" /><Button variant="outline" onClick={async () => { const b = await (await fetch(url)).blob(); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `documento-${d.id}.jpg`; a.click(); URL.revokeObjectURL(u); }}>Baixar</Button></>}</div><div className="space-y-3"><Label>Classificação</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select><Label>Situação</Label><Select value={situacao} onValueChange={setSituacao}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pendente","analisado","nova_foto"].map(k => <SelectItem value={k} key={k}>{k === "nova_foto" ? "Solicitar nova fotografia" : k}</SelectItem>)}</SelectContent></Select>{selector("Nota fiscal",nota,setNota,ns.map(n => ({id:n.id,label:`NF ${n.numero} • ${n.cliente}`})))}{selector("Carga",carga,setCarga,cs.map(c => ({id:c.id,label:`Carga ${c.numero}`})))}{selector("Entrega",entrega,setEntrega,es.map(e => ({id:e.id,label:`NF ${e.notas_fiscais?.numero ?? "—"}`})))}<Label>Observações</Label><Input value={obs} onChange={e => setObs(e.target.value)} /><Button disabled={busy} onClick={async () => { setBusy(true); const { error } = await supabase.rpc("triar_documento",{_id:d.id,_tipo:tipo,_situacao:situacao,_obs:obs,_nota:nota === "none" ? undefined : nota,_carga:carga === "none" ? undefined : carga,_entrega:entrega === "none" ? undefined : entrega}); setBusy(false); if(error) toast.error(error.message); else {qc.invalidateQueries();close();toast.success("Documento analisado");} }}>Salvar análise</Button></div></div></DialogContent></Dialog>;
}