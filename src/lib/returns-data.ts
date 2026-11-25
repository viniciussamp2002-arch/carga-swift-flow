import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
async function all(query: any) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await query.range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...r.data);
    if (r.data.length < 1000) return rows;
  }
}
export const returnsOptions = queryOptions({ queryKey: ["returns-workspace"], queryFn: async () => {
  const [docs, returns, items, pallets, allocations, moves, reservations, notes, profiles, fornecedores, motoristas] = await Promise.all([
    all(supabase.from("comprovantes").select("*,motoristas(nome),cargas(numero)").eq("tipo_documento", "devolucao").order("capturado_em", { ascending: false })),
    all(supabase.from("devolucoes").select("*").order("controle")),
    all(supabase.from("devolucao_itens").select("*").eq("ativo", true).order("created_at")),
    all(supabase.from("devolucao_pallets").select("*").order("numero")),
    all(supabase.from("devolucao_alocacoes").select("*").order("created_at")),
    all(supabase.from("devolucao_movimentos").select("*").order("created_at")),
    all(supabase.from("devolucao_reservas").select("*").order("created_at")),
    all(supabase.from("notas_fiscais").select("id,numero,chave_nfe,fornecedor,cliente,cidade,uf,itens_xml").order("numero")),
    all(supabase.from("profiles").select("id,nome").order("nome")),
    all(supabase.from("fornecedores").select("id,nome").order("nome")),
    all(supabase.from("motoristas").select("id,nome").order("nome")),
  ]);
  return { docs, returns, items, pallets, allocations, moves, reservations, notes, profiles, fornecedores, motoristas };
} });