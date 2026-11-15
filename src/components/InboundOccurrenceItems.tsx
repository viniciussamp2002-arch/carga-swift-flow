import { Fragment, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { OcorrenciaBadge, RegistrarOcorrencia, useOcorrencias } from "./Ocorrencias";
import { parseNFeXml, unitLabel, type NFeItem } from "@/lib/xml-parser";
import { validateAffectedQuantity } from "@/lib/occurrence-rules";
import type { ReceivingNote } from "@/lib/receiving-rules";
import { fmtNum } from "@/lib/format";
import { ChevronDown, ChevronRight, Plus, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function InboundOccurrenceItems({ notes, transporte, etapa = "recebimento", readOnly = false }: { notes: ReceivingNote[]; transporte?: string; etapa?: string; readOnly?: boolean }) {
  const map = useOcorrencias();
  const { canWrite } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <div className="overflow-auto"><table className="table-erp"><thead><tr><th>NF</th><th>Fornecedor</th><th>Cliente</th><th>Ocorrências</th></tr></thead><tbody>{notes.map(n => <Fragment key={n.id}><tr className={map.has(n.id) ? "occurrence-row" : ""} onClick={() => setExpanded(expanded === n.id ? null : n.id)}><td><Button variant="ghost" size="sm" aria-expanded={expanded === n.id}>{expanded === n.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}NF {n.numero}</Button></td><td>{n.fornecedor}</td><td>{n.cliente}</td><td><OcorrenciaBadge nota={n} etapa={etapa} />{!map.has(n.id) && "Sem ocorrência"}</td></tr>{expanded === n.id && <tr><td colSpan={4}><ProductItems note={n} transporte={transporte} etapa={etapa} writable={canWrite && !readOnly} /></td></tr>}</Fragment>)}</tbody></table></div>;
}
function ProductItems({ note, transporte, etapa, writable }: { note: ReceivingNote; transporte?: string; etapa: string; writable: boolean }) {
  const items = Array.isArray(note.itens_xml) ? note.itens_xml as NFeItem[] : [];
  const [selected, setSelected] = useState<NFeItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [create, setCreate] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function recover(file: File) {
    setBusy(true);
    try {
      const parsed = parseNFeXml(await file.text());
      if ("error" in parsed) throw new Error(parsed.error);
      if (parsed.chave_nfe !== note.chave_nfe) throw new Error("O XML não corresponde a esta nota fiscal");
      const r = await supabase.rpc("recuperar_itens_xml", { _nota: note.id, _chave: parsed.chave_nfe, _itens: JSON.parse(JSON.stringify(parsed.itens_xml)) });
      if (r.error) throw r.error;
      qc.invalidateQueries({ queryKey: ["carga-entrada", note.carga_entrada_id] });
      toast.success("Produtos recuperados sem duplicar a nota");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível recuperar os produtos"); } finally { setBusy(false); }
  }
  if (!items.length) return <div className="space-y-2"><p className="text-sm">Produtos não disponíveis no registro antigo. Selecione o XML original desta NF.</p>{writable && <><input type="file" accept=".xml" hidden ref={input} onChange={e => { const file = e.target.files?.[0]; if (file) void recover(file); e.target.value = ""; }} /><Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-4 w-4" />Recuperar produtos do XML</Button></>}</div>;
  return <div className="space-y-3"><table className="table-erp"><thead><tr><th></th><th>Código</th><th>Produto</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>{items.map(item => <tr key={item.numero} onClick={() => { setSelected(item); setQuantity(""); }}><td><Checkbox aria-label={`Selecionar produto ${item.codigo}`} disabled={!writable} checked={selected?.numero === item.numero} /></td><td>{item.codigo}</td><td className="!whitespace-normal min-w-40">{item.descricao}</td><td>{fmtNum(item.quantidade)}</td><td>{unitLabel(item.unidade)}</td></tr>)}</tbody></table>{selected && writable && <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Quantidade afetada ({unitLabel(selected.unidade)})<Input aria-label="Quantidade afetada do produto" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><Button size="sm" onClick={() => { try { validateAffectedQuantity(Number(quantity)); setCreate(true); } catch (e) { toast.error(e instanceof Error ? e.message : "Quantidade inválida"); } }}><Plus className="h-4 w-4" />Registrar Ocorrência</Button></div>}{create && selected && <RegistrarOcorrencia nota={note} item={selected} quantidadeAfetada={Number(quantity)} transporte={transporte} etapa={etapa} onClose={() => setCreate(false)} />}</div>;
}