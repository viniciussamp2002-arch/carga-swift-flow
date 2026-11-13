import { supabase } from "@/integrations/supabase/client";
import { parseNFeXml, type ParsedNFe } from "@/lib/xml-parser";
import { classifyKey, validFiscalKey } from "@/lib/nfe-rules";

/** Reject each invalid/duplicate file without discarding valid siblings. */
export async function lerXmls(files: FileList | File[]): Promise<{ ok: ParsedNFe[]; erros: string[]; nomes: Map<string, string> }> {
  const parsed: { nota: ParsedNFe; nome: string }[] = []; const erros: string[] = [];
  for (const f of Array.from(files)) {
    try {
      const p = parseNFeXml(await f.text());
      if ("error" in p) erros.push(`${f.name}: ${p.error}`); else parsed.push({ nota: p, nome: f.name });
    } catch { erros.push(`${f.name}: não foi possível ler o arquivo`); }
  }
  const chaves = [...new Set(parsed.map(p => p.nota.chave_nfe).filter(validFiscalKey))];
  const existing: { chave_nfe: string | null; chaves_agrupadas: string[]; numero: string; carga_entrada: { numero_transporte: string } | null }[] = [];
  for (let i = 0; i < chaves.length; i += 100) {
    const batch = chaves.slice(i, i + 100);
    const { data, error } = await supabase.from("notas_fiscais").select("chave_nfe,chaves_agrupadas,numero,carga_entrada:carga_entrada_id(numero_transporte)")
      .or(`chave_nfe.in.(${batch.join(",")}),chaves_agrupadas.ov.{${batch.join(",")}}`);
    if (error) return { ok: [], erros: [...erros, "Não foi possível verificar duplicatas. Nenhuma nota foi importada."], nomes: new Map() };
    existing.push(...(data ?? []));
  }
  const seen = new Set<string>(); const ok: ParsedNFe[] = []; const nomes = new Map<string, string>();
  for (const { nota, nome } of parsed) {
    const reason = classifyKey(nota.chave_nfe, seen, existing);
    if (reason) {
      const dup = existing.find(n => n.chave_nfe === nota.chave_nfe || n.chaves_agrupadas.includes(nota.chave_nfe));
      erros.push(`${nome}: ${reason}${dup ? ` (NF ${dup.numero}, ${dup.carga_entrada ? `transporte ${dup.carga_entrada.numero_transporte}` : "depósito / outra operação"})` : ""}`);
    } else { ok.push(nota); nomes.set(nota.chave_nfe, nome); }
  }
  return { ok, erros, nomes };
}
