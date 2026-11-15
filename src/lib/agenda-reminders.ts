export type ReminderKind = "amanha" | "vencido" | "aguardando";
export const REMINDER_LABEL: Record<ReminderKind, string> = {
  amanha: "Agendada para amanhã",
  vencido: "Agendamento vencido — entrega pendente",
  aguardando: "Aguardando Agendamento",
};

/** Data local da operação (Teresina/PI) no formato AAAA-MM-DD. */
export function operationDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nota sai das pendências apenas quando entregue (status só muda após aprovação do escritório). */
export function isDelivered(notaStatus: string | null | undefined) { return notaStatus === "entregue"; }

export function classifyReminder(
  ag: { data_agendada: string | null; status: string },
  notaStatus: string,
  today: string,
): ReminderKind | null {
  if (isDelivered(notaStatus) || ag.status === "cancelado") return null;
  if (!ag.data_agendada) return "aguardando";
  if (ag.data_agendada < today) return "vencido";
  if (ag.data_agendada === addDays(today, 1)) return "amanha";
  return null;
}

/** Situação operacional derivada, sem criar novos status. */
export function operationalSituation(ag: { data_agendada: string | null; status: string }, notaStatus: string, today: string) {
  if (isDelivered(notaStatus)) return "Entregue";
  if (!ag.data_agendada) return "Aguardando agendamento";
  if (ag.data_agendada < today) return "Agendamento vencido";
  if (ag.data_agendada === today) return "Entrega pendente";
  return "Agendada";
}
