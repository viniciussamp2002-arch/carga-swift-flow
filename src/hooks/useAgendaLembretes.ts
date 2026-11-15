import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyReminder, operationDate, type ReminderKind } from "@/lib/agenda-reminders";

export type Lembrete = { id: string; notaId: string; numero: string; cliente: string; cidade: string; uf: string | null; data: string | null; horario: string | null; situacao: string; kind: ReminderKind };

/** Fonte única dos lembretes: usada pelo sino de Agendamentos e pelo indicador do cabeçalho. */
export function useAgendaLembretes(enabled = true) {
  return useQuery({
    queryKey: ["agendamentos", "lembretes"],
    enabled,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("agendamentos")
        .select("id, data_agendada, horario, status, nota:nota_id(id, numero, cliente, cidade, uf, status, recebida)");
      if (error) throw error;
      const today = operationDate();
      const out: Lembrete[] = [];
      for (const r of (data ?? []) as any[]) {
        if (!r.nota?.recebida) continue;
        const kind = classifyReminder(r, r.nota.status, today);
        if (kind) out.push({ id: r.id, notaId: r.nota.id, numero: r.nota.numero, cliente: r.nota.cliente, cidade: r.nota.cidade, uf: r.nota.uf, data: r.data_agendada, horario: r.horario, situacao: r.nota.status, kind });
      }
      const order: Record<ReminderKind, number> = { vencido: 0, amanha: 1, aguardando: 2 };
      return out.sort((a, b) => order[a.kind] - order[b.kind] || String(a.data ?? "").localeCompare(String(b.data ?? "")));
    },
  });
}
