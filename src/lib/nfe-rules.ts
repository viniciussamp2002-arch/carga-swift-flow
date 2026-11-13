export interface FiscalKeyRow { chave_nfe: string | null; chaves_agrupadas: string[] }
export function validFiscalKey(key: string) { return /^\d{44}$/.test(key); }
export function classifyKey(key: string, seen: Set<string>, existing: FiscalKeyRow[]) {
  if (!validFiscalKey(key)) return "Chave de acesso inválida: são necessários 44 dígitos";
  if (seen.has(key)) return "XML repetido neste lote";
  seen.add(key);
  if (existing.some(n => n.chave_nfe === key || n.chaves_agrupadas.includes(key))) return "NF já cadastrada";
  return null;
}
export function recipientGroupKey(note: { id: string; cnpj_destinatario: string | null; carga_entrada_id?: string | null }) {
  const recipient = note.cnpj_destinatario?.replace(/\D/g, "");
  return recipient ? `${note.carga_entrada_id ?? "deposito"}:${recipient}` : `nota:${note.id}`;
}