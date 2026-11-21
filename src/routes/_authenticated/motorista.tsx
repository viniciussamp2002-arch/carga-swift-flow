import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Camera, CloudUpload, Loader2, WifiOff, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { queueAdd, queueList, queueRemove, type QueuedProof } from "@/lib/proof-queue";
import { reconhecerComprovante } from "@/lib/proofs.functions";
import { DriverPhoto } from "@/components/DriverPhoto";
import { driverNoteState, DRIVER_ORDER, DRIVER_MESSAGE } from "@/lib/driver-document-rules";
import { PROOF_TYPES } from "@/lib/proof-review-rules";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/motorista")({
  head: () => pageHead("Portal do Motorista", "Envio de fotos de canhotos de entrega."),
  component: DriverPage,
});

const PROOF_LABEL: Record<string, string> = { pendente: "Em leitura", identificado: "Em análise", nao_identificado: "Em análise (conferência)", aprovado: "Aprovado", rejeitado: "Rejeitado" };

function DriverPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const recognize = useServerFn(reconhecerComprovante);
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<(QueuedProof & { url: string })[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const busy = useRef(false);
  const [target, setTarget] = useState<{ cargaId?: string; notaId?: string }>({});
  const [selectedLoad, setSelectedLoad] = useState("");
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ["driver-me", user?.id],
    queryFn: async () => (await supabase.from("motoristas").select("id,nome").eq("user_id", user?.id ?? "").maybeSingle()).data,
    enabled: !!user,
  });
  const { data: loads = [] } = useQuery({ queryKey: ["driver-loads", me?.id], enabled: !!me, refetchInterval: 30000, queryFn: async () => { const r = await supabase.from("cargas").select("id,numero,status").order("numero"); if (r.error) throw r.error; return r.data; } });
  const { data: notas = [] } = useQuery({
    queryKey: ["driver-notas", me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("notas_fiscais").select("id,numero,cliente,cidade,uf,status,carga_id,cargas:carga_id(numero)").order("cidade")).data ?? [],
  });
  const { data: provas = [] } = useQuery({
    queryKey: ["driver-provas", user?.id],
    enabled: !!me,
    refetchInterval: 30000,
    queryFn: async () => (await supabase.from("comprovantes").select("id,status,tipo_documento,triagem,capturado_em,motivo_rejeicao,nota_envio_id,nota_id,carga_id,storage_path,notas_fiscais:nota_id(numero)").eq("user_id", user?.id ?? "").order("capturado_em", { ascending: false }).limit(50)).data ?? [],
  });

  const refreshQueue = useCallback(async () => {
    if (!user) return;
    const items = await queueList(user.id);
    setQueue((old) => { old.forEach((o) => URL.revokeObjectURL(o.url)); return items.map((i) => ({ ...i, url: URL.createObjectURL(i.blob) })); });
  }, [user]);

  const sync = useCallback(async () => {
    if (!user || !me || busy.current || !navigator.onLine) return;
    busy.current = true; setSyncing(true);
    try {
      for (const item of await queueList(user.id)) {
        const path = `${user.id}/${item.id}.jpg`;
        const up = await supabase.storage.from("comprovantes").upload(path, item.blob, { contentType: item.blob.type || "image/jpeg", upsert: false });
        if (up.error && !/exists|duplicate/i.test(up.error.message)) { await queueAdd({ ...item, tries: item.tries + 1, lastError: up.error.message }); continue; }
        const ins = await supabase.from("comprovantes").insert({ id: item.id, motorista_id: me.id, storage_path: path, capturado_em: item.capturedAt, ...(item.cargaId ? { carga_id: item.cargaId } : {}), ...(item.notaId ? { nota_envio_id: item.notaId } : {}) });
        if (ins.error && ins.error.code !== "23505") { await queueAdd({ ...item, tries: item.tries + 1, lastError: ins.error.message }); continue; }
        // only remove locally after the server confirmed the row exists
        const { data: ok } = await supabase.from("comprovantes").select("id").eq("id", item.id).maybeSingle();
        if (!ok) continue;
        await queueRemove(item.id);
        recognize({ data: { id: item.id } }).catch(() => {}).finally(() => qc.invalidateQueries({ queryKey: ["driver-provas"] }));
      }
    } finally {
      busy.current = false; setSyncing(false);
      await refreshQueue(); qc.invalidateQueries({ queryKey: ["driver-provas"] });
    }
  }, [user, me, recognize, qc, refreshQueue]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueue();
    const on = () => { setOnline(true); sync(); }, off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const t = setInterval(sync, 30000);
    navigator.storage?.persist?.().catch(() => {});
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(t); };
  }, [refreshQueue, sync]);
  useEffect(() => { if (me) sync(); }, [me, sync]);

  async function onFiles(files: FileList | null) {
    if (!files || !user) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast.error(`${f.name}: envie apenas fotos`); continue; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: foto acima de 10 MB`); continue; }
      try { await queueAdd({ id: crypto.randomUUID(), userId: user.id, blob: f, capturedAt: new Date().toISOString(), tries: 0, ...target }); }
      catch { toast.error("Sem espaço no celular para guardar a foto"); }
    }
    if (fileRef.current) fileRef.current.value = "";
    await refreshQueue(); sync();
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  if (!me) return <div className="max-w-md mx-auto p-4 text-sm bg-card border rounded-md">Seu acesso ainda não está vinculado a um motorista. Peça ao escritório para vincular em <b>Usuários</b>.</div>;

  const currentLoad = loads.some(l => l.id === selectedLoad) ? selectedLoad : loads[0]?.id || "";
  const loadProofs = provas.filter(p => p.carga_id === currentLoad);
  const noteRows = notas.filter(n => n.carga_id === currentLoad).map(n => {
    const proof = provas.find(p => (p.nota_id === n.id || p.nota_envio_id === n.id) && ["canhoto", "nao_identificado"].includes(p.tipo_documento));
    const state = driverNoteState(n.status, proof);
    return { ...n, proof, state };
  }).sort((a, b) => DRIVER_ORDER[a.state] - DRIVER_ORDER[b.state]);
  const tone = { pendente: "bg-warning/15 border-warning/40", analise: "bg-info/15 border-info/40", aprovada: "bg-success/15 border-success/40", correcao: "bg-destructive/10 border-destructive/40" };
  const photograph = (notaId?: string) => { if (!currentLoad) { toast.error("Nenhuma carga em andamento"); return; } setTarget({ cargaId: currentLoad, ...(notaId ? { notaId } : {}) }); fileRef.current?.click(); };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">Motorista</div>
        <h1 className="text-xl font-bold text-primary">{me.nome}</h1>
        {!online && <div className="mt-1 text-xs flex items-center gap-1 text-destructive"><WifiOff className="h-3 w-3" />Sem internet — as fotos ficam guardadas no celular</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) setPreview({ file, url: URL.createObjectURL(file) }); }} />
      <div><label className="text-sm font-semibold" htmlFor="driver-load">Carga em andamento</label><select id="driver-load" className="w-full h-12 border rounded-md bg-background px-3" value={currentLoad} onChange={e => setSelectedLoad(e.target.value)}>{loads.map(l => <option value={l.id} key={l.id}>Carga #{l.numero}</option>)}{!loads.length && <option value="">Nenhuma carga em andamento</option>}</select></div>
      <Button disabled={!currentLoad} className="w-full h-16 text-lg" onClick={() => photograph()}><Camera className="h-6 w-6 mr-2" />Fotografar Documento</Button>

      {preview && <div className="space-y-2"><img src={preview.url} alt="Documento fotografado" className="w-full max-h-96 object-contain" /><div className="flex gap-2"><Button variant="outline" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>Descartar</Button><Button onClick={async () => { const dt = new DataTransfer(); dt.items.add(preview.file); await onFiles(dt.files); URL.revokeObjectURL(preview.url); setPreview(null); }}>Confirmar foto</Button></div></div>}
      <Section title={`Fotos aguardando envio (${queue.length})`} action={queue.length > 0 && <Button size="sm" variant="outline" onClick={sync} disabled={syncing || !online}>{syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CloudUpload className="h-3 w-3 mr-1" />}Enviar</Button>}>
        {queue.length === 0 ? <Empty>Nenhuma foto pendente</Empty> :
          <div className="grid grid-cols-3 gap-2">{queue.map((q) => <div key={q.id} className="relative"><img src={q.url} alt="Canhoto aguardando envio" className="aspect-square object-cover rounded border" />{q.lastError && <span className="absolute bottom-0 inset-x-0 text-[10px] bg-destructive text-destructive-foreground px-1 truncate">erro, tentará de novo</span>}</div>)}</div>}
      </Section>

      <section className="space-y-3"><h2 className="text-lg font-bold">Notas da carga</h2>{noteRows.map(n => <article key={n.id} className={`border rounded-md p-3 space-y-3 ${tone[n.state]}`}>
        <div className="text-lg font-bold break-words">NF {n.numero} · {n.cliente}</div><div className="text-sm">{n.cidade}/{n.uf}</div>
        <div className="flex gap-2 font-bold items-start">{n.state === "aprovada" ? <CheckCircle2 className="shrink-0" /> : n.state === "analise" ? <Clock className="shrink-0" /> : <AlertTriangle className="shrink-0" />}<span>{DRIVER_MESSAGE[n.state]}</span></div>
        {n.state === "analise" && <p className="text-base">Aguarde a conferência do escritório.</p>}
        {(n.state === "pendente" || n.state === "correcao") && <Button className="w-full min-h-12 text-base" onClick={() => photograph(n.id)}><Camera className="mr-2" />{n.state === "correcao" ? "Enviar outra foto" : "Fotografar canhoto"}</Button>}
        {n.proof && user && <DriverPhoto id={n.proof.id} path={n.proof.storage_path} userId={user.id} />}
      </article>)}{!noteRows.length && <Empty>Nenhuma nota nesta carga</Empty>}</section>
      <section className="space-y-3"><h2 className="text-lg font-bold">Documentos da carga ({loadProofs.length})</h2>{loadProofs.map(p => <div key={p.id} className="flex gap-3 items-start border-b pb-3">
        {user && <DriverPhoto id={p.id} path={p.storage_path} userId={user.id} />}<div className="min-w-0"><div className="font-semibold">{PROOF_TYPES[p.tipo_documento]}</div><div className="text-base">{p.triagem === "nova_foto" || p.status === "rejeitado" ? "Correção necessária" : p.status === "aprovado" || p.triagem === "analisado" && p.tipo_documento !== "canhoto" ? "Aprovado pelo escritório" : "Em análise"}</div><div className="text-xs text-muted-foreground">{fmtDateTime(p.capturado_em)}</div>{p.motivo_rejeicao && <p>{p.motivo_rejeicao}</p>}</div>
      </div>)}</section>
    </div>
  );
}

function Section({ title, action, children }: any) {
  return <section className="bg-card border rounded-md"><div className="flex items-center justify-between px-3 py-2 border-b"><h2 className="text-sm font-bold">{title}</h2>{action}</div><div className="p-2 space-y-1">{children}</div></section>;
}
const Empty = ({ children }: any) => <div className="text-xs text-muted-foreground px-1 py-2">{children}</div>;
const Row = ({ left, right, sub }: any) => <div className="flex justify-between gap-2 px-1 py-1.5 border-b last:border-0 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{left}</div><div className="text-xs text-muted-foreground">{sub}</div></div><div className="text-xs shrink-0">{right}</div></div>;
