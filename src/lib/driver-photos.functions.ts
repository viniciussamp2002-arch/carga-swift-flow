import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const driverPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("comprovantes").select("id,user_id,storage_path,carga_id").eq("id", data.id).maybeSingle();
    if (r.error || !r.data || r.data.user_id !== context.userId || !r.data.carga_id) throw new Error("Documento indisponível para este motorista");
    const load = await context.supabase.from("cargas").select("id,situacao,status,data_finalizacao,motoristas(user_id)").eq("id", r.data.carga_id).maybeSingle();
    if (load.error || !load.data || load.data.motoristas?.user_id !== context.userId || load.data.situacao !== "ativa" || load.data.status === "finalizada" || load.data.data_finalizacao) throw new Error("Carga finalizada ou não atribuída ao motorista");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const f = await supabaseAdmin.storage.from("comprovantes").download(r.data.storage_path);
    if (f.error || !f.data) throw new Error("Foto indisponível");
    const bytes = new Uint8Array(await f.data.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(binary), mime: f.data.type || "image/jpeg" };
  });