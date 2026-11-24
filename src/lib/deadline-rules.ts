export type Prazo = "no_prazo" | "proximo" | "vencido" | "sem_previsao";
export const PRAZO_LABEL: Record<Prazo, string> = { no_prazo: "No prazo", proximo: "Próximas do vencimento", vencido: "Prazo vencido", sem_previsao: "Sem previsão" };
export const PRAZO_CLASS: Record<Prazo, string> = {
  no_prazo: "text-info font-semibold",
  proximo: "text-warning-foreground bg-warning/25 rounded px-1 font-semibold",
  vencido: "text-destructive font-semibold",
  sem_previsao: "text-muted-foreground italic",
};
export const ALERTA_DIAS = 2;

/** Data de hoje (YYYY-MM-DD) no fuso de Teresina. */
export function hojeTeresina(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function diffDias(de: string, ate: string): number {
  return Math.round((Date.parse(ate + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 86400000);
}
export function classificarPrazo(previsao: string | null | undefined, hoje: string, alerta = ALERTA_DIAS): { prazo: Prazo; texto: string; dias: number | null } {
  if (!previsao) return { prazo: "sem_previsao", texto: "Sem previsão", dias: null };
  const d = diffDias(hoje, previsao);
  if (d < 0) return { prazo: "vencido", texto: `${-d} dia${d === -1 ? "" : "s"} de atraso`, dias: d };
  if (d <= alerta) return { prazo: "proximo", texto: d === 0 ? "Vence hoje" : d === 1 ? "Vence amanhã" : `Vence em ${d} dias`, dias: d };
  return { prazo: "no_prazo", texto: "No prazo", dias: d };
}
export function permanencia(recebimento: string | null | undefined, hoje: string): string {
  if (!recebimento) return "Sem data de recebimento";
  const d = diffDias(recebimento.slice(0, 10), hoje);
  return d <= 0 ? "Recebida hoje" : `${d} dia${d === 1 ? "" : "s"} no depósito`;
}
export function resultadoEntrega(previsao: string | null | undefined, entrega: string | null | undefined): string {
  if (!previsao) return "Sem previsão cadastrada";
  if (!entrega) return "—";
  const d = diffDias(previsao, entrega.slice(0, 10));
  return d > 0 ? `Com atraso (${d} dia${d === 1 ? "" : "s"})` : "Dentro do prazo";
}
