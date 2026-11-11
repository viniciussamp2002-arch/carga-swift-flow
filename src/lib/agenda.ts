export const AG_STATUS_LABEL: Record<string, string> = {
  nao_solicitado: "Não solicitado", solicitado: "Solicitado", aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado", reagendado: "Reagendado", cancelado: "Cancelado",
};
export const REC_CLIENTE_LABEL: Record<string, string> = {
  aguardando_entrada: "Aguardando entrada", entrada_realizada: "Entrada realizada", entrada_recusada: "Entrada recusada",
};
export const ENTRADA_STATUS_LABEL: Record<string, string> = {
  prevista: "Prevista", em_transito: "Em trânsito", recebida_parcial: "Recebida parcialmente", recebida: "Recebida", cancelada: "Cancelada",
};
export const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
