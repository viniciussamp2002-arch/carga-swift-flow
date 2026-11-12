import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { AlertTriangle, Paperclip } from "lucide-react";

export const OC_TIPO_LABEL: Record<string, string> = {
  falta: "Falta", avaria: "Avaria", sobra: "Sobra", divergencia_volumes: "Divergência de volumes", outros: "Outros",
};
export const OC_STATUS_LABEL: Record<string, string> = { aberta: "Aberta", em_analise: "Em análise", resolvida: "Resolvida" };

/** Single source: every module reads the same ocorrencias rows, grouped by nota. */
export function useOcorrencias() {
  const { canWrite } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["ocorrencias"],
    enabled: canWrite,
    queryFn: async () => {
      const { data, error } = await supabase.from("ocorrencias").select("*").order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return useMemo(() => {
    const m = new Map<string, any[]>();
    for (const o of data) m.set(o.nota_id, [...(m.get(o.nota_id) ?? []), o]);
    return m;
  }, [data]);
}

export function OcorrenciaBadge({ nota }: { nota: { id: string; numero?: string } }) {
  const map = useOcorrencias();
  const [open, setOpen] = useState(false);
  const list = map.get(nota.id) ?? [];
  if (!list.length) return null;
  const abertas = list.filter((o) => o.status !== "resolvida").length;
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={abertas ? `${abertas} ocorrência(s) aberta(s)` : "Ocorrências resolvidas"}
        className={`inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-semibold align-middle ml-1 ${abertas ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-muted text-muted-foreground"}`}>
        <AlertTriangle className="h-3 w-3" />Ocorrência{list.length > 1 ? ` (${list.length})` : ""}
      </button>
      {open && <OcorrenciasDetalhe nota={nota} list={list} onClose={() => setOpen(false)} />}
    </>
  );
}

function OcorrenciasDetalhe({ nota, list, onClose }: { nota: any; list: any[]; onClose: () => void }) {
  const { canWrite, user } = useAuth();
  const qc = useQueryClient();
  const upd = useMutation({
    mutationFn: async ({ o, status }: { o: any; status: string }) => {
      const { error } = await supabase.from("ocorrencias").update({ status: status as any }).eq("id", o.id);
      if (error) throw error;
      await supabase.from("historico").insert({ entidade: "ocorrencia", entidade_id: o.nota_id, acao: "status", user_id: user?.id,
        descricao: `NF ${nota.numero ?? ""} — ocorrência ${OC_TIPO_LABEL[o.tipo]}: ${OC_STATUS_LABEL[o.status]} → ${OC_STATUS_LABEL[status]}` });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
    onError: (e: any) => toast.error(e.message),
  });
  async function abrirAnexo(path: string) {
    const { data, error } = await supabase.storage.from("ocorrencias").createSignedUrl(path, 300);
    if (error) toast.error(error.message); else window.open(data.signedUrl, "_blank");
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Ocorrências — NF {nota.numero}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {list.map((o) => (
            <div key={o.id} className={`border rounded-md p-2 text-sm ${o.status === "resolvida" ? "opacity-70" : "border-destructive/40"}`}>
              <div className="flex items-center gap-2">
                <b>{OC_TIPO_LABEL[o.tipo]}</b>
                {o.quantidade != null && <span>{fmtNum(o.quantidade)} {o.unidade}</span>}
                <span className="text-xs text-muted-foreground">({o.origem})</span>
                <span className="ml-auto">
                  {canWrite ? <select className="h-7 border rounded px-1 bg-background text-xs" value={o.status} disabled={upd.isPending}
                    onChange={(e) => upd.mutate({ o, status: e.target.value })}>
                    {Object.entries(OC_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    : OC_STATUS_LABEL[o.status]}
                </span>
              </div>
              {o.descricao && <p className="mt-1">{o.descricao}</p>}
              <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                <span>{fmtDateTime(o.data_ocorrencia)}</span><span>{o.registrado_por_nome || "—"}</span>
                {o.anexo_path && <button className="underline inline-flex items-center gap-1" onClick={() => abrirAnexo(o.anexo_path)}><Paperclip className="h-3 w-3" />Anexo</button>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrarOcorrencia({ nota, transporte, cargaEntradaId, onClose }: { nota: any; transporte?: string; cargaEntradaId?: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const idRef = useRef(crypto.randomUUID()); // stable id: repeated clicks can't create duplicates
  const agora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [f, setF] = useState({ tipo: "falta", quantidade: "", unidade: "", descricao: "", quando: agora });
  const [file, setFile] = useState<File | null>(null);
  const mut = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      if (file) {
        anexo_path = `${nota.id}/${idRef.current}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("ocorrencias").upload(anexo_path, file, { upsert: true });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from("ocorrencias").insert({
        id: idRef.current, origem: "recebimento", nota_id: nota.id, chave_nfe: nota.chave_nfe, carga_entrada_id: cargaEntradaId ?? nota.carga_entrada_id,
        tipo: f.tipo as any, quantidade: f.quantidade === "" ? null : Number(f.quantidade), unidade: f.unidade || null,
        descricao: f.descricao, data_ocorrencia: new Date(f.quando).toISOString(), anexo_path,
        registrado_por: user?.id, registrado_por_nome: user?.email,
      });
      if (error && error.code !== "23505") throw error;
      await supabase.from("historico").insert({ entidade: "ocorrencia", entidade_id: nota.id, acao: "criacao", user_id: user?.id,
        descricao: `NF ${nota.numero} — ocorrência ${OC_TIPO_LABEL[f.tipo]} registrada${f.quantidade ? ` (${f.quantidade} ${f.unidade})` : ""}` });
    },
    onSuccess: () => { toast.success("Ocorrência registrada"); qc.invalidateQueries({ queryKey: ["ocorrencias"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  const L = ({ l, c }: { l: string; c: React.ReactNode }) => <div className="space-y-1"><Label className="text-[11px]">{l}</Label>{c}</div>;
  return (
    <Dialog open onOpenChange={(o) => !o && !mut.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar ocorrência</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <L l="Nota fiscal" c={<Input value={nota.numero} disabled />} />
          <L l="Transporte" c={<Input value={transporte ?? ""} disabled />} />
          <L l="Cliente" c={<Input value={nota.cliente ?? ""} disabled />} />
          <L l="Fornecedor" c={<Input value={nota.fornecedor ?? ""} disabled />} />
          <L l="Tipo" c={<select className="h-9 w-full border rounded px-2 bg-background text-sm" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(OC_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>} />
          <L l="Data e horário" c={<Input type="datetime-local" value={f.quando} onChange={(e) => setF({ ...f, quando: e.target.value })} />} />
          <L l="Quantidade afetada" c={<Input type="number" min="0" step="any" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} />} />
          <L l="Unidade (ex.: fardos, caixas)" c={<Input value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} />} />
          <div className="col-span-2"><L l="Descrição" c={<Textarea rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />} /></div>
          <L l="Responsável" c={<Input value={user?.email ?? ""} disabled />} />
          <L l="Foto / documento (opcional)" c={<Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />} />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={mut.isPending} onClick={onClose}>Cancelar</Button>
          <Button disabled={mut.isPending || !f.quando} onClick={() => mut.mutate()}>{mut.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
