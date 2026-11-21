export type DriverState = "correcao" | "pendente" | "analise" | "aprovada";
export function loadAllowsDocuments(load: { situacao: string; status: string; data_finalizacao: string | null }) {
  return load.situacao === "ativa" && load.status !== "finalizada" && load.data_finalizacao === null;
}
export function driverNoteState(noteStatus: string, proof?: { status: string; triagem: string; tipo_documento: string }): DriverState {
  if (proof?.status === "aprovado" && proof.tipo_documento === "canhoto" && noteStatus === "entregue") return "aprovada";
  if (proof?.status === "rejeitado" || proof?.triagem === "nova_foto") return "correcao";
  if (proof && proof.tipo_documento === "canhoto" || proof?.tipo_documento === "nao_identificado") return "analise";
  return "pendente";
}
export const DRIVER_ORDER: Record<DriverState, number> = { correcao: 0, pendente: 1, analise: 2, aprovada: 3 };
export const DRIVER_MESSAGE: Record<DriverState, string> = {
  pendente: "PENDENTE — FALTA ENVIAR FOTO",
  analise: "EM ANÁLISE — FOTO ENVIADA",
  aprovada: "ENTREGA APROVADA",
  correcao: "CORREÇÃO NECESSÁRIA — ENVIE OUTRA FOTO",
};