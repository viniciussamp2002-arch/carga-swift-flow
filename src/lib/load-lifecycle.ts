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
export interface NotaComCarga {
  status: string;
  carga_id?: string | null;
  cargas?: { status: string; situacao: string } | null;
}
/** Só entram em uma carga notas livres do Depósito: disponíveis e sem vínculo com outra carga. */
export function canAddNotesToOutboundLoad(notes: NotaComCarga[]) {
  return notes.length > 0 && notes.every((n) => n.status === "disponivel" && !n.carga_id);
}
/** Notas que podem voltar ao Depósito: as de uma carga ativa ainda em separação ou carregamento. */
export function notesRemovableFromOutboundLoad(notes: NotaComCarga[]) {
  return notes.filter((n) =>
    n.cargas?.situacao === "ativa"
    && ["separacao", "carregamento"].includes(String(n.cargas?.status))
    && ["separacao", "carregamento"].includes(String(n.status)));
}
export function validateLoadAction(action: LoadAction, reason: string, inspection: LoadInspection) {
  if (!reason.trim()) throw new Error("Informe a justificativa");
  if (inspection.situacao === "excluida") throw new Error("Carga já excluída");
  if (action === "excluir" && !inspection.pode_excluir) throw new Error("Carga com movimentação ou vínculos: utilize cancelamento ou arquivamento");
  if (action === "cancelar" && inspection.situacao !== "ativa") throw new Error("Somente cargas ativas podem ser canceladas");
  if (action === "arquivar" && inspection.situacao === "arquivada") throw new Error("Carga já arquivada");
}