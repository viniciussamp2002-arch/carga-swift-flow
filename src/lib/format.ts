export const fmtNum = (n: number | null | undefined, d = 0) =>
  (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtKg = (n: number | null | undefined) => fmtNum(n, 3) + " kg";
export const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleDateString("pt-BR");
};
export const fmtDateTime = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleString("pt-BR");
};

export const NOTA_STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  separacao: "Separação",
  carregamento: "Carregamento",
  em_rota: "Em rota",
  entregue: "Entregue",
  nao_entregue: "Não entregue",
  devolvida: "Devolvida",
};
export const NOTA_STATUS_COLOR: Record<string, string> = {
  disponivel: "bg-info/15 text-info border-info/30",
  separacao: "bg-warning/15 text-warning-foreground border-warning/40",
  carregamento: "bg-warning/20 text-warning-foreground border-warning/40",
  em_rota: "bg-primary/15 text-primary border-primary/30",
  entregue: "bg-success/15 text-success border-success/30",
  nao_entregue: "bg-destructive/15 text-destructive border-destructive/30",
  devolvida: "bg-destructive/20 text-destructive border-destructive/40",
};

export const CARGA_STATUS_LABEL: Record<string, string> = {
  separacao: "Separação",
  carregamento: "Carregamento",
  em_rota: "Em rota",
  finalizada: "Finalizada",
};

export const VEICULO_SIT_LABEL: Record<string, string> = {
  disponivel: "Disponível", em_rota: "Em rota", manutencao: "Manutenção", inativo: "Inativo",
};
export const MOTORISTA_SIT_LABEL: Record<string, string> = {
  disponivel: "Disponível", em_viagem: "Em viagem", ferias: "Férias", afastado: "Afastado",
};
