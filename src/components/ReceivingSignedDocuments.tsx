import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Eye, Download, Printer, Camera } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { validateSignedFile } from "@/lib/receiving-report-rules";
import { downloadBlob } from "@/lib/occurrence-pdf";
import type { SignedAttachment } from "@/lib/receiving-reports";
export function PdfViewer({
  preview,
  onClose,
}: {
  preview: { url: string; name: string };
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>{preview.name}</DialogTitle>
        </DialogHeader>
        <iframe
          ref={frame}
          title="Documento de recebimento"
          src={preview.url}
          className="w-full h-[60vh] border"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const a = document.createElement("a");
              a.href = preview.url;
              a.download = preview.name;
              a.click();
            }}
          >
            <Download className="h-4 w-4" />
            Baixar
          </Button>
          <Button
            onClick={() => {
              try {
                frame.current?.contentWindow?.print();
              } catch {
                window.open(preview.url, "_blank", "noopener,noreferrer");
              }
            }}
          >
            <Printer className="h-4 w-4" />
            Imprimir novamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function SignedReceivingDocuments({
  loadId,
  receiptId,
  reportId,
  label,
  readOnly = false,
}: {
  loadId: string;
  receiptId?: string;
  reportId?: string;
  label: "Recibo" | "Ocorrência";
  readOnly?: boolean;
}) {
  const { canReceive, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const target = receiptId || reportId;
  const attachments = useQuery({
    queryKey: ["signed-receiving", target],
    queryFn: async () => {
      let q = supabase
        .from("anexos_recebimento_assinados")
        .select("*")
        .eq("carga_entrada_id", loadId);
      q = receiptId ? q.eq("recibo_id", receiptId) : q.eq("relatorio_id", reportId || "");
      const r = await q.order("versao", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const rows = attachments.data || [];
  const writable = canReceive && !readOnly && (!rows.length || isAdmin);
  function select(file?: File) {
    if (!file) return;
    try {
      validateSignedFile(file);
      setPending(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido");
    }
  }
  async function upload() {
    if (!pending || !target) return;
    setBusy(true);
    try {
      const identity = await supabase.auth.getUser();
      if (!identity.data.user) throw new Error("Entre novamente no sistema");
      const id = crypto.randomUUID(),
        path = `${identity.data.user.id}/${id}`;
      const sent = await supabase.storage
        .from("recebimento-assinados")
        .upload(path, pending, { contentType: pending.type, upsert: false });
      if (sent.error) throw sent.error;
      const r = await supabase
        .from("anexos_recebimento_assinados")
        .insert({
          id,
          carga_entrada_id: loadId,
          recibo_id: receiptId || null,
          relatorio_id: reportId || null,
          storage_path: path,
          nome_arquivo: pending.name,
          mime_type: pending.type,
        })
        .select()
        .single();
      if (r.error) throw r.error;
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["signed-receiving", target] });
      qc.invalidateQueries({ queryKey: ["receiving-reports"] });
      qc.invalidateQueries({ queryKey: ["receiving-history", loadId] });
      toast.success("Documento assinado anexado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível anexar o documento");
    } finally {
      setBusy(false);
    }
  }
  async function open(row: SignedAttachment, download = false) {
    setBusy(true);
    try {
      const r = await supabase.storage.from("recebimento-assinados").download(row.storage_path);
      if (r.error) throw r.error;
      if (download) downloadBlob(r.data, row.nome_arquivo);
      else {
        if (preview) URL.revokeObjectURL(preview.url);
        setPreview({ url: URL.createObjectURL(r.data), name: row.nome_arquivo });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-2 border-t py-3">
      <p className="text-sm font-medium">
        {rows.length
          ? `${label} assinad${label === "Recibo" ? "o" : "a"} anexad${label === "Recibo" ? "o" : "a"}`
          : "Aguardando assinatura"}
      </p>
      {attachments.error && (
        <p role="alert" className="text-destructive">
          Não foi possível consultar anexos.
        </p>
      )}
      {writable && (
        <div className="flex flex-wrap gap-2">
          <input
            hidden
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              select(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            hidden
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => {
              select(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || attachments.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {rows.length
              ? "Substituir anexo"
              : `Anexar ${label} Assinad${label === "Recibo" ? "o" : "a"}`}
          </Button>
          <Button
            size="icon"
            variant="outline"
            disabled={busy || attachments.isPending}
            aria-label="Fotografar documento assinado"
            title="Fotografar documento assinado"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
      )}
      {rows.map((row, index) => (
        <div className="flex flex-wrap gap-2 items-center border-b py-2 text-xs" key={row.id}>
          <span className="break-all flex-1">
            {index === 0 ? "Atual · " : ""}Versão {row.versao} · {row.nome_arquivo} ·{" "}
            {row.registrado_por_nome} · {fmtDateTime(row.created_at)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            title="Visualizar assinado"
            aria-label="Visualizar assinado"
            disabled={busy}
            onClick={() => open(row)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Baixar assinado"
            aria-label="Baixar assinado"
            disabled={busy}
            onClick={() => open(row, true)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {pending && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar envio do documento assinado</DialogTitle>
            </DialogHeader>
            <p className="break-all">{pending.name}</p>
            <p className="text-sm">
              {label} · {target}
            </p>
            <Button disabled={busy} onClick={upload}>
              {busy ? "Enviando..." : "Confirmar envio"}
            </Button>
          </DialogContent>
        </Dialog>
      )}
      {preview && (
        <PdfViewer
          preview={preview}
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
        />
      )}
    </section>
  );
}
