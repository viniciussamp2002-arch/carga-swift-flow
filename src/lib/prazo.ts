// Prazo helpers — dias restantes até data_limite e badge de cor
export function diasRestantes(dataLimite: string | null | undefined): number | null {
  if (!dataLimite) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const lim = new Date(dataLimite + "T00:00:00");
  return Math.round((lim.getTime() - hoje.getTime()) / 86400000);
}

export function prazoBadge(dias: number | null): { label: string; className: string } {
  if (dias === null) return { label: "—", className: "bg-muted text-muted-foreground border-border" };
  if (dias < 0) return { label: `${Math.abs(dias)}d atrasado`, className: "bg-red-900/25 text-red-900 border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" };
  if (dias === 0) return { label: "Vence hoje", className: "bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-400" };
  if (dias === 1) return { label: "1 dia", className: "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400" };
  if (dias === 2) return { label: "2 dias", className: "bg-yellow-500/20 text-yellow-800 border-yellow-500/40 dark:text-yellow-300" };
  return { label: `${dias} dias`, className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-400" };
}
