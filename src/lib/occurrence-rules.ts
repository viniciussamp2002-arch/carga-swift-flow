export const OC_TIPO_LABEL: Record<string, string> = {
  falta: "Falta de mercadoria", avaria: "Avaria", sobra: "Sobra", divergencia_volumes: "Divergência de volumes",
  produto_vencido: "Produto vencido", produto_recusado: "Produto recusado pelo cliente", entrega_nao_realizada: "Entrega não realizada",
  devolucao: "Devolução", lacre_violado: "Lacre violado", divergencia_documental: "Divergência documental", outros: "Outros",
};
export const OC_STATUS_LABEL: Record<string, string> = { aberta: "Aberta", em_analise: "Em análise", resolvida: "Resolvida" };
export const OC_ETAPA_LABEL: Record<string, string> = {
  recebimento: "Recebimento", conferencia: "Conferência física", deposito: "Depósito", transporte: "Transporte",
  tentativa_entrega: "Tentativa de entrega", pos_entrega: "Após a entrega",
};
export function occurrenceState(list: { status: string }[] = []) {
  return list.length === 0 ? "Sem ocorrência" : list.some(o => o.status !== "resolvida") ? "Ocorrência aberta" : "Ocorrência resolvida";
}
export function occurrenceOrigin(etapa: string): "recebimento" | "entrega" {
  return ["transporte", "tentativa_entrega", "pos_entrega"].includes(etapa) ? "entrega" : "recebimento";
}
export function validateOccurrenceUpdate(status: string, resolucao: string) {
  if (status === "resolvida" && !resolucao.trim()) throw new Error("Informe a solução adotada");
}