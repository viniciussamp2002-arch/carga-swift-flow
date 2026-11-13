import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Camera, CloudUpload, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { queueAdd, queueList, queueRemove, type QueuedProof } from "@/lib/proof-queue";
import { reconhecerComprovante } from "@/lib/proofs.functions";
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

  const { data: me, isLoading } = useQuery({
    queryKey: ["driver-me", user?.id],
    queryFn: async () => (await supabase.from("motoristas").select("id,nome").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });
  const { data: notas = [] } = useQuery({
    queryKey: ["driver-notas", me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("notas_fiscais").select("id,numero,cliente,cidade,uf,status,cargas:carga_id(numero)").order("cidade")).data ?? [],
  });
  const { data: provas = [] } = useQuery({
    queryKey: ["driver-provas", user?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("comprovantes").select("id,status,capturado_em,motivo_rejeicao,notas_fiscais:nota_id(numero)").eq("user_id", user!.id).order("capturado_em", { ascending: false }).limit(50)).data ?? [],
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
        const ins = await supabase.from("comprovantes").insert({ id: item.id, motorista_id: me.id, storage_path: path, capturado_em: item.capturedAt });
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
      try { await queueAdd({ id: crypto.randomUUID(), userId: user.id, blob: f, capturedAt: new Date().toISOString(), tries: 0 }); }
      catch { toast.error("Sem espaço no celular para guardar a foto"); }
    }
    if (fileRef.current) fileRef.current.value = "";
    await refreshQueue(); sync();
  }

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Carregando...</div>;
  if (!me) return <div className="max-w-md mx-auto p-4 text-sm bg-card border rounded-md">Seu acesso ainda não está vinculado a um motorista. Peça ao escritório para vincular em <b>Usuários</b>.</div>;

  const pendentes = notas.filter((n: any) => n.status !== "entregue");
  const analise = provas.filter((p: any) => !["aprovado", "rejeitado"].includes(p.status));
  const concluidas = provas.filter((p: any) => ["aprovado", "rejeitado"].includes(p.status));

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <div className="text-xs text-muted-foreground">Motorista</div>
        <h1 className="text-xl font-bold text-primary">{me.nome}</h1>
        {!online && <div className="mt-1 text-xs flex items-center gap-1 text-destructive"><WifiOff className="h-3 w-3" />Sem internet — as fotos ficam guardadas no celular</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button className="w-full h-16 text-lg" onClick={() => fileRef.current?.click()}><Camera className="h-6 w-6 mr-2" />Fotografar canhoto</Button>

      <Section title={`Fotos aguardando envio (${queue.length})`} action={queue.length > 0 && <Button size="sm" variant="outline" onClick={sync} disabled={syncing || !online}>{syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CloudUpload className="h-3 w-3 mr-1" />}Enviar</Button>}>
        {queue.length === 0 ? <Empty>Nenhuma foto pendente</Empty> :
          <div className="grid grid-cols-3 gap-2">{queue.map((q) => <div key={q.id} className="relative"><img src={q.url} alt="Canhoto aguardando envio" className="aspect-square object-cover rounded border" />{q.lastError && <span className="absolute bottom-0 inset-x-0 text-[10px] bg-destructive text-destructive-foreground px-1 truncate">erro, tentará de novo</span>}</div>)}</div>}
      </Section>

      <Section title={`Comprovantes em análise (${analise.length})`}>
        {analise.length === 0 ? <Empty>Nenhum</Empty> : analise.map((p: any) => <Row key={p.id} left={p.notas_fiscais?.numero ? `NF ${p.notas_fiscais.numero}` : "NF a identificar"} right={PROOF_LABEL[p.status]} sub={fmtDateTime(p.capturado_em)} />)}
      </Section>

      <Section title={`Entregas pendentes (${pendentes.length})`}>
        {pendentes.length === 0 ? <Empty>Nenhuma entrega atribuída</Empty> : pendentes.map((n: any) => <Row key={n.id} left={`NF ${n.numero} • ${n.cliente}`} right={`Carga #${n.cargas?.numero ?? "—"}`} sub={`${n.cidade}/${n.uf ?? ""}`} />)}
      </Section>

      <Section title={`Concluídos (${concluidas.length})`}>
        {concluidas.length === 0 ? <Empty>Nenhum</Empty> : concluidas.map((p: any) => <Row key={p.id} left={p.notas_fiscais?.numero ? `NF ${p.notas_fiscais.numero}` : "Canhoto"} right={PROOF_LABEL[p.status]} sub={p.motivo_rejeicao ? `Motivo: ${p.motivo_rejeicao}` : fmtDateTime(p.capturado_em)} />)}
      </Section>
    </div>
  );
}

function Section({ title, action, children }: any) {
  return <section className="bg-card border rounded-md"><div className="flex items-center justify-between px-3 py-2 border-b"><h2 className="text-sm font-bold">{title}</h2>{action}</div><div className="p-2 space-y-1">{children}</div></section>;
}
const Empty = ({ children }: any) => <div className="text-xs text-muted-foreground px-1 py-2">{children}</div>;
const Row = ({ left, right, sub }: any) => <div className="flex justify-between gap-2 px-1 py-1.5 border-b last:border-0 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{left}</div><div className="text-xs text-muted-foreground">{sub}</div></div><div className="text-xs shrink-0">{right}</div></div>;
