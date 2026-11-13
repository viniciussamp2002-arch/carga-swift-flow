export interface ProofCandidate { id: string; numero: string; serie?: string | null; chave_nfe?: string | null; chaves_agrupadas?: string[] | null; numeros_agrupados?: string[] | null; carga_id?: string | null }
export interface ProofReading { chave?: string | null; numero?: string | null; serie?: string | null }
export type ProofMatch = { status: "identificado"; nota_id: string; criterio: "chave" | "numero_serie" | "numero" } | { status: "nao_identificado"; motivo: string };

const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const num = (s?: string | null) => digits(s).replace(/^0+/, "");

/** Matches a reading only against the driver's own notes. Key first; number alone must be unique. */
export function matchProof(reading: ProofReading, notes: ProofCandidate[]): ProofMatch {
  const chave = digits(reading.chave);
  if (chave.length === 44) {
    const hit = notes.filter((n) => digits(n.chave_nfe) === chave || (n.chaves_agrupadas ?? []).some((k) => digits(k) === chave));
    if (hit.length === 1) return { status: "identificado", nota_id: hit[0].id, criterio: "chave" };
  }
  const numero = num(reading.numero);
  if (!numero) return { status: "nao_identificado", motivo: "Nenhum número de NF legível" };
  const byNum = notes.filter((n) => num(n.numero) === numero || (n.numeros_agrupados ?? []).some((x) => num(x) === numero));
  const serie = num(reading.serie);
  if (serie) {
    const both = byNum.filter((n) => num(n.serie) === serie);
    if (both.length === 1) return { status: "identificado", nota_id: both[0].id, criterio: "numero_serie" };
  }
  if (byNum.length === 1) return { status: "identificado", nota_id: byNum[0].id, criterio: "numero" };
  if (byNum.length > 1) return { status: "nao_identificado", motivo: "Número corresponde a mais de uma NF; conferir" };
  return { status: "nao_identificado", motivo: "NF não pertence às cargas do motorista" };
}
