import { COMPANY } from "./company";
export type Answer = "sim" | "nao" | "na" | "";
export const CHECK_QUESTIONS = {
  lacrado: "Veículo chegou lacrado?", lacre_integro: "Lacre íntegro?", limpo: "Condições de limpeza adequadas?",
  violacao: "Indícios de avaria ou violação?", falta: "Houve falta?", sobra: "Houve sobra?", avaria: "Houve avaria?",
  divergencia_produtos: "Houve divergência de produtos?", produto_vencido: "Houve produto vencido?",
};
export interface ReceivingNote { id: string; numero: string; fornecedor: string; cliente?: string; peso: number; volumes: number; recebida?: boolean }
export interface ReceivingLoad { id: string; numero_transporte: string; transportadora: string; motorista?: string | null; placa?: string | null; data_chegada?: string | null; recebido_por_nome?: string | null }
export interface ReceivingData {
  empresa: typeof COMPANY; transporte: string; transportadora: string; motorista: string; placa: string; reboque: string;
  data: string; conferente: string; fornecedores: string[]; notas: ReceivingNote[]; peso_kg: number; volumes_previstos: number;
  volumes_recebidos: number | null; tarifa: number; toneladas: number; valor_total: number; numero_lacre: string;
  condicoes_veiculo: string; observacoes: string; respostas: Record<string, Answer>;
  ocorrencias: { numero: string; tipo: string; descricao: string; status: string; quantidade: number | null; unidade: string | null }[];
}
export function unloadingCost(kg: number, rate: number) {
  if (!Number.isFinite(kg) || !Number.isFinite(rate) || kg < 0 || rate < 0) throw new Error("Peso e tarifa devem ser válidos e não negativos");
  const tonnes = kg / 1000;
  return { toneladas: tonnes, valor_total: Math.round((tonnes * rate + Number.EPSILON) * 100) / 100 };
}
export function receivingTotals(notes: ReceivingNote[]) {
  const unique = [...new Map(notes.map(n => [n.id, n])).values()];
  return { peso: unique.reduce((s,n) => s + Number(n.peso || 0),0), volumes: unique.reduce((s,n) => s + Number(n.volumes || 0),0), fornecedores: [...new Set(unique.map(n => n.fornecedor).filter(Boolean))], notas: unique };
}
export function initialReceivingData(load: ReceivingLoad, notes: ReceivingNote[], responsible: string): ReceivingData {
  const totals = receivingTotals(notes);
  return { empresa: COMPANY, transporte: load.numero_transporte, transportadora: load.transportadora, motorista: load.motorista || "", placa: load.placa || "", reboque: "",
    data: load.data_chegada || "", conferente: load.recebido_por_nome || responsible, fornecedores: totals.fornecedores, notas: totals.notas,
    peso_kg: totals.peso, volumes_previstos: totals.volumes, volumes_recebidos: null, tarifa: 0, toneladas: totals.peso / 1000, valor_total: 0,
    numero_lacre: "", condicoes_veiculo: "", observacoes: "", respostas: {}, ocorrencias: [] };
}
export function hasReceivingDivergence(data?: Pick<ReceivingData, "respostas" | "volumes_previstos" | "volumes_recebidos"> | null) {
  if (!data) return false;
  return ["violacao", "falta", "sobra", "avaria", "divergencia_produtos", "produto_vencido"].some(k => data.respostas[k] === "sim") ||
    data.respostas.lacre_integro === "nao" || data.respostas.limpo === "nao" ||
    (data.volumes_recebidos != null && data.volumes_recebidos !== data.volumes_previstos);
}
export function validateChecklist(data: ReceivingData) {
  if (!data.conferente.trim() || !data.data || Number.isNaN(Date.parse(data.data))) throw new Error("Informe conferente e data da conferência");
  if (data.volumes_recebidos == null || !Number.isInteger(data.volumes_recebidos) || data.volumes_recebidos < 0) throw new Error("Informe a quantidade de volumes recebidos");
}