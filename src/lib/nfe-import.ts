import { supabase } from "@/integrations/supabase/client";
import { parseNFeXml, type ParsedNFe } from "@/lib/xml-parser";

/** Lê os XMLs e bloqueia repetidos (na seleção ou já cadastrados). */
export async function lerXmls(files: FileList | File[]): Promise<{ ok: ParsedNFe[]; erros: string[] }> {
  const ok: ParsedNFe[] = []; const erros: string[] = [];
  for (const f of Array.from(files)) {
    const p = parseNFeXml(await f.text());
    if ("error" in p) erros.push(`${f.name}: ${p.error}`); else ok.push(p);
  }
  const chaves = ok.map((p) => p.chave_nfe).filter(Boolean);
  if (new Set(chaves).size !== chaves.length) return { ok: [], erros: [...erros, "Há XMLs repetidos na seleção."] };
  if (chaves.length) {
    const { data: dup } = await supabase.from("notas_fiscais").select("numero")
      .or(`chave_nfe.in.(${chaves.map((c) => `"${c}"`).join(",")}),chaves_agrupadas.ov.{${chaves.join(",")}}`);
    if (dup?.length) return { ok: [], erros: [...erros, `Nota(s) já importada(s): ${dup.map((d) => d.numero).join(", ")}`] };
  }
  return { ok, erros };
}
