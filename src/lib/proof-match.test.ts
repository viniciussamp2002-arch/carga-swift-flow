import { describe, it, expect } from "vitest";
import { matchProof } from "./proof-match";
const K = "2".repeat(44);
const notes = [
  { id: "a", numero: "000123", serie: "1", chave_nfe: K },
  { id: "b", numero: "456", serie: "1", chave_nfe: "3".repeat(44) },
  { id: "c", numero: "456", serie: "2", chave_nfe: "4".repeat(44) },
];
describe("matchProof", () => {
  it("prioriza a chave de 44 dígitos", () => expect(matchProof({ chave: K, numero: "999" }, notes)).toEqual({ status: "identificado", nota_id: "a", criterio: "chave" }));
  it("aceita número com zeros à esquerda", () => expect(matchProof({ numero: "123" }, notes)).toMatchObject({ nota_id: "a" }));
  it("número ambíguo vai para conferência", () => expect(matchProof({ numero: "456" }, notes).status).toBe("nao_identificado"));
  it("desempata por série", () => expect(matchProof({ numero: "456", serie: "2" }, notes)).toMatchObject({ nota_id: "c", criterio: "numero_serie" }));
  it("NF de outro motorista não é associada", () => expect(matchProof({ chave: "9".repeat(44), numero: "777" }, notes).status).toBe("nao_identificado"));
});
