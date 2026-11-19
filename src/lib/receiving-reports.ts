import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
export type OccurrenceReport =
  Database["public"]["Tables"]["relatorios_ocorrencias_recebimento"]["Row"];
export type SignedAttachment = Database["public"]["Tables"]["anexos_recebimento_assinados"]["Row"];
export interface OccurrenceSnapshot {
  transporte: string;
  transportadora: string;
  motorista: string;
  placa: string;
  cpf: string;
  data: string;
  conferente: string;
  ocorrencia_ids: string[];
  ocorrencias: {
    id: string;
    numero_nf: string;
    fornecedor: string;
    produto_codigo: string | null;
    produto_descricao: string | null;
    quantidade: number | null;
    unidade: string | null;
    tipo: string;
    descricao: string;
  }[];
}
export const receivingReportsOptions = queryOptions({
  queryKey: ["receiving-reports"],
  queryFn: async () => {
    async function all<T>(
      fetch: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    ) {
      const result: T[] = [];
      for (let from = 0; ; from += 1000) {
        const r = await fetch(from);
        if (r.error) throw r.error;
        result.push(...(r.data || []));
        if (!r.data || r.data.length < 1000) break;
      }
      return result;
    }
    const [docs, loads, occurrences, notes, reports, links, attachments, cancellations] =
      await Promise.all([
        all((from) =>
          supabase
            .from("documentos_recebimento")
            .select("*")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("cargas_entrada")
            .select("*")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("ocorrencias")
            .select("*")
            .eq("origem", "recebimento")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("notas_fiscais")
            .select("id,numero,fornecedor,carga_entrada_id")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("relatorios_ocorrencias_recebimento")
            .select("*")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("relatorio_ocorrencia_vinculos")
            .select("*")
            .order("relatorio_id")
            .order("ocorrencia_id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("anexos_recebimento_assinados")
            .select("*")
            .order("id")
            .range(from, from + 999),
        ),
        all((from) =>
          supabase
            .from("recibo_recebimento_eventos")
            .select("*")
            .order("id")
            .range(from, from + 999),
        ),
      ]);
    return { docs, loads, occurrences, notes, reports, links, attachments, cancellations };
  },
});
