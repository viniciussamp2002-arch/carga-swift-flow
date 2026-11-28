export type LoadKind = "entrada" | "saida";
export type LoadAction = "excluir" | "cancelar" | "arquivar";
export const LOAD_STATE_LABEL: Record<string, string> = { ativa: "Ativa", cancelada: "Cancelada", arquivada: "Arquivada", excluida: "Excluída" };
export interface LoadInspection {
  numero: string;
  notas: number;
  status: string;
  situacao: string;
  bloqueios: string[];
  pode_excluir: boolean;
}
export function canEditOutboundLoad(load: { status: string; situacao: string }) {
  return load.situacao === "ativa" && load.status !== "finalizada";
}
export function canRemoveOutboundNotes(load: { status: string; situacao: string }) {
  return load.situacao === "ativa" && ["separacao", "carregamento"].includes(load.status);
}
export function canUndoOutboundLoad(load: { status: string; situacao: string }) {
  return load.situacao !== "excluida" && ["separacao", "carregamento"].includes(load.status);
}
export function validateLoadAction(action: LoadAction, reason: string, inspection: LoadInspection) {
  if (!reason.trim()) throw new Error("Informe a justificativa");
  if (inspection.situacao === "excluida") throw new Error("Carga já excluída");
  if (action === "excluir" && !inspection.pode_excluir) throw new Error("Carga com movimentação ou vínculos: utilize cancelamento ou arquivamento");
  if (action === "cancelar" && inspection.situacao !== "ativa") throw new Error("Somente cargas ativas podem ser canceladas");
  if (action === "arquivar" && inspection.situacao === "arquivada") throw new Error("Carga já arquivada");
}