import { describe, expect, it } from "vitest";
import { occurrenceState, occurrenceOrigin, validateOccurrenceUpdate, OC_ETAPA_LABEL, OC_TIPO_LABEL } from "./occurrence-rules";
describe("Ocorrências permanentes", () => {
  it("mantém a identificação após resolução", () => expect(occurrenceState([{ status: "resolvida" }])).toBe("Ocorrência resolvida"));
  it("prioriza pendências em um grupo misto", () => expect(occurrenceState([{ status: "resolvida" }, { status: "em_analise" }])).toBe("Ocorrência aberta"));
  it("distingue notas sem histórico", () => expect(occurrenceState([])).toBe("Sem ocorrência"));
  it("exige solução na resolução", () => expect(() => validateOccurrenceUpdate("resolvida", " ")).toThrow("Informe a solução adotada"));
  it("permite observações sem resolver", () => expect(() => validateOccurrenceUpdate("em_analise", "")).not.toThrow());
  it("identifica origem de pós-entrega", () => expect(occurrenceOrigin("pos_entrega")).toBe("entrega"));
  it("identifica conferência como recebimento", () => expect(occurrenceOrigin("conferencia")).toBe("recebimento"));
  it("inclui as seis etapas operacionais", () => expect(Object.keys(OC_ETAPA_LABEL)).toEqual(["recebimento", "conferencia", "deposito", "transporte", "tentativa_entrega", "pos_entrega"]));
  it("inclui os onze tipos padronizados", () => expect(Object.keys(OC_TIPO_LABEL)).toEqual(["falta", "avaria", "sobra", "divergencia_volumes", "produto_vencido", "produto_recusado", "entrega_nao_realizada", "devolucao", "lacre_violado", "divergencia_documental", "outros"]));
});