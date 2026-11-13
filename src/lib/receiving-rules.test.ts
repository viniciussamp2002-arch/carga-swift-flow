import { describe, expect, it } from "vitest";
import { hasReceivingDivergence, initialReceivingData, receivingTotals, unloadingCost, validateChecklist } from "./receiving-rules";
const note = { id: "nf1", numero: "1", fornecedor: "Fornecedor A", peso: 8500, volumes: 100 };
const load = { id: "carga1", numero_transporte: "582", transportadora: "Origem" };
describe("Checklist e descarga", () => {
  it("calcula 8.500 kg a R$35/t como R$297,50", () => expect(unloadingCost(8500,35)).toEqual({ toneladas:8.5, valor_total:297.5 }));
  it("arredonda descarga em centavos", () => expect(unloadingCost(1001,35).valor_total).toBe(35.04));
  it("recusa tarifas negativas", () => expect(() => unloadingCost(8500,-35)).toThrow());
  it("não conta duas vezes a mesma NF agrupada", () => expect(receivingTotals([note,note]).peso).toBe(8500));
  it("mantém todos os fornecedores", () => expect(receivingTotals([note,{...note,id:"nf2",fornecedor:"Fornecedor B"}]).fornecedores).toEqual(["Fornecedor A","Fornecedor B"]));
  it("não altera peso fiscal ao calcular tarifa", () => { unloadingCost(note.peso,35); expect(note.peso).toBe(8500); });
  it("detecta diferença entre previstos e recebidos", () => expect(hasReceivingDivergence({ respostas:{},volumes_previstos:100,volumes_recebidos:99 })).toBe(true));
  it("detecta lacre violado", () => expect(hasReceivingDivergence({respostas:{lacre_integro:"nao"},volumes_previstos:100,volumes_recebidos:100})).toBe(true));
  it("não trata não se aplica como divergência", () => expect(hasReceivingDivergence({respostas:{lacre_integro:"na"},volumes_previstos:100,volumes_recebidos:100})).toBe(false));
  it("exige responsável e data para salvar", () => expect(() => validateChecklist(initialReceivingData(load,[note],""))).toThrow());
  it("exige volumes recebidos inteiros", () => {const d=initialReceivingData(load,[note],"Conferente");d.data="2026-11-13";d.volumes_recebidos=1.5;expect(()=>validateChecklist(d)).toThrow();});
});