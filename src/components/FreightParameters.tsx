import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
type Note = Database["public"]["Tables"]["notas_fiscais"]["Row"];
export function FreightParameters({ note, close }: { note: Note; close: () => void }) {
  const qc=useQueryClient();
  const [peso,setPeso]=useState(String(note.peso_frete??note.peso));
  const [cidade,setCidade]=useState(note.destino_entrega_cidade??note.cidade);
  const [uf,setUf]=useState(note.destino_entrega_uf??note.uf??"");
  const [tabela,setTabela]=useState(note.tabela_frete_id??"auto");
  const [motivo,setMotivo]=useState("");const [busy,setBusy]=useState(false);
  const {data:tables=[]}=useQuery({queryKey:["note-freight-contracts",note.cnpj_emissor],queryFn:async()=>{
    const r=await supabase.from("tabelas_frete").select("id,nome,versao,inicio,fim,fornecedores!inner(cnpj)").eq("ativo",true).eq("fornecedores.cnpj",(note.cnpj_emissor??"").replace(/\D/g,""));if(r.error)throw r.error;return r.data;
  }});
  return <Dialog open onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Parâmetros do frete — NF {note.numero}</DialogTitle></DialogHeader><Label htmlFor="freight-weight">Peso operacional (kg)</Label><Input id="freight-weight" type="number" min="0" step="0.001" value={peso} onChange={e=>setPeso(e.target.value)}/><Label htmlFor="freight-city">Local efetivo de entrega</Label><Input id="freight-city" value={cidade} onChange={e=>setCidade(e.target.value)}/><Label htmlFor="freight-state">UF</Label><Input id="freight-state" maxLength={2} value={uf} onChange={e=>setUf(e.target.value.toUpperCase())}/><Label>Contrato</Label><Select value={tabela} onValueChange={setTabela}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">Automático, somente se houver um contrato</SelectItem>{tables.map(t=><SelectItem key={t.id} value={t.id}>{t.nome} • v{t.versao} • {t.inicio}</SelectItem>)}</SelectContent></Select><Label htmlFor="freight-reason">Justificativa</Label><Input id="freight-reason" value={motivo} onChange={e=>setMotivo(e.target.value)}/><Button disabled={busy||motivo.trim().length<3||peso===""||!cidade||uf.length!==2} onClick={async()=>{setBusy(true);const r=await supabase.rpc("ajustar_parametros_frete",{_nota:note.id,_peso:Number(peso),_cidade:cidade,_uf:uf,_tabela:tabela==="auto"?undefined:tabela,_motivo:motivo});setBusy(false);if(r.error)toast.error(r.error.message);else{qc.invalidateQueries();toast.success("Parâmetros salvos e frete recalculado");close();}}}>Salvar e recalcular</Button></DialogContent></Dialog>;
}