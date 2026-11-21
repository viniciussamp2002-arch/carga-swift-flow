import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyReminder, operationDate, reminderEventKey, type ReminderKind } from "@/lib/agenda-reminders";
import { useAuth } from "@/hooks/useAuth";

export type Lembrete = { id: string; evento: string; notaId: string; numero: string; cliente: string; cidade: string; uf: string | null; data: string | null; horario: string | null; situacao: string; kind: ReminderKind };

/** Fonte única dos lembretes: usada pelo sino de Agendamentos e pelo indicador do cabeçalho. */
export function useAgendaLembretes(enabled = true) {
  const { user, canWrite } = useAuth();
  return useQuery({
    queryKey: ["agendamentos", "lembretes", user?.id],
    enabled: enabled && !!user && canWrite,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("agendamentos")
        .select("id, data_agendada, horario, status, updated_at, nota:nota_id(id, numero, cliente, cidade, uf, status, recebida)");
      if (error) throw error;
      const dismiss = await supabase.from("notificacoes_dispensadas").select("evento_chave").eq("user_id", user?.id ?? "");
      if (dismiss.error) throw dismiss.error;
      const hidden = new Set(dismiss.data.map(d => d.evento_chave));
      const today = operationDate();
      const out: Lembrete[] = [];
      for (const r of (data ?? []) as any[]) {
        if (!r.nota?.recebida) continue;
        const kind = classifyReminder(r, r.nota.status, today);
        if (kind) {
          const evento = reminderEventKey(r.id, kind, r);
          if (!hidden.has(evento)) out.push({ id: r.id, evento, notaId: r.nota.id, numero: r.nota.numero, cliente: r.nota.cliente, cidade: r.nota.cidade, uf: r.nota.uf, data: r.data_agendada, horario: r.horario, situacao: r.nota.status, kind });
        }
      }
      const order: Record<ReminderKind, number> = { vencido: 0, amanha: 1, aguardando: 2 };
      return out.sort((a, b) => order[a.kind] - order[b.kind] || String(a.data ?? "").localeCompare(String(b.data ?? "")));
    },
  });
}
