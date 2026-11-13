import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchProof, type ProofReading } from "./proof-match";

/** Reads a delivery receipt photo with AI and links it to one of the driver's notes. Never approves. */
export const reconhecerComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // RLS: only owner driver or office can read the row
    const { data: c } = await context.supabase.from("comprovantes").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Comprovante não encontrado");
    if (c.status !== "pendente" && c.status !== "nao_identificado") return { status: c.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: fe } = await supabaseAdmin.storage.from("comprovantes").download(c.storage_path);
    if (fe || !file) throw new Error("Foto não encontrada");
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${btoa(bin)}`;

    const { data: cargas } = await supabaseAdmin.from("cargas").select("id").eq("motorista_id", c.motorista_id).eq("situacao", "ativa");
    const ids = (cargas ?? []).map((x) => x.id);
    const { data: notes } = ids.length
      ? await supabaseAdmin.from("notas_fiscais").select("id,numero,serie,chave_nfe,chaves_agrupadas,numeros_agrupados,carga_id").in("carga_id", ids)
      : { data: [] as any[] };

    let reading: ProofReading = {};
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const r: any = await generateResponse({
        model: "openai/gpt-6-astra",
        input: [{ role: "user", content: [
          { type: "input_text", text: "Esta é a foto de um canhoto/DANFE de nota fiscal brasileira. Extraia a chave de acesso (44 dígitos), o número da NF e a série. Use null se ilegível; não invente." },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ] }],
        text: { format: { type: "json_schema", name: "canhoto", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["chave", "numero", "serie"],
          properties: { chave: { type: ["string", "null"] }, numero: { type: ["string", "null"] }, serie: { type: ["string", "null"] } } } } },
      } as any);
      const txt = r.output_text ?? (r.output ?? []).flatMap((o: any) => o.content ?? []).find((p: any) => p.type === "output_text")?.text ?? "{}";
      reading = JSON.parse(txt);
    } catch (e) {
      console.error("OCR falhou", e);
      await supabaseAdmin.from("comprovantes").update({ status: "nao_identificado", reconhecimento: { erro: "Leitura automática indisponível" } }).eq("id", c.id).in("status", ["pendente", "nao_identificado"]);
      return { status: "nao_identificado" };
    }
    const m = matchProof(reading, notes ?? []);
    const carga = m.status === "identificado" ? (notes ?? []).find((n: any) => n.id === m.nota_id)?.carga_id ?? null : null;
    await supabaseAdmin.from("comprovantes").update({
      status: m.status, nota_id: m.status === "identificado" ? m.nota_id : null, carga_id: carga,
      reconhecimento: { ...reading, ...(m.status === "identificado" ? { criterio: m.criterio } : { motivo: m.motivo }) },
    }).eq("id", c.id).in("status", ["pendente", "nao_identificado"]);
    return { status: m.status };
  });
