import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";

/** Approved proof per nota_id (latest), for listing screens. */
export function useCanhotosAprovados() {
  const { data } = useQuery({
    queryKey: ["canhotos-aprovados"],
    queryFn: async () => (await supabase.from("comprovantes").select("id,nota_id,storage_path,data_entrega,revisado_em")
      .eq("status", "aprovado").not("nota_id", "is", null).order("revisado_em", { ascending: false })).data ?? [],
  });
  const map = new Map<string, any>();
  for (const c of data ?? []) if (c.nota_id && !map.has(c.nota_id)) map.set(c.nota_id, c);
  return map;
}

async function signed(path: string, download?: string) {
  const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(path, 600, download ? { download } : undefined);
  if (error || !data) { toast.error("Não foi possível abrir o canhoto"); return null; }
  return data.signedUrl;
}

export function CanhotoButtons({ canhoto, numero }: { canhoto?: any; numero: string }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!canhoto) return <span className="text-xs text-muted-foreground">Sem canhoto</span>;
  const ext = canhoto.storage_path.split(".").pop() || "jpg";
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => setUrl(await signed(canhoto.storage_path))}>
        <Eye className="h-3 w-3 mr-1" />Ver
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
        const u = await signed(canhoto.storage_path, `canhoto-NF-${numero}.${ext}`); if (u) window.location.href = u;
      }}><Download className="h-3 w-3 mr-1" />Baixar</Button>
      <Dialog open={!!url} onOpenChange={(o) => !o && setUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Canhoto — NF {numero}</DialogTitle></DialogHeader>
          {url && <img src={url} alt={`Canhoto da NF ${numero}`} className="w-full max-h-[75vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
