export const PENDING_PROOF_STATUSES = ["pendente", "identificado", "nao_identificado"];

export function isAwaitingProofReview(proof: { status: string; tipo_documento: string }) {
  return PENDING_PROOF_STATUSES.includes(proof.status);
}

export const PROOF_TYPES: Record<string, string> = {
  canhoto: "Canhoto de entrega",
  devolucao: "Nota de devolução",
  recibo: "Recibo de descarga",
  recusa: "Comprovante de recusa",
  outro: "Outro documento",
  nao_identificado: "Não identificado",
};