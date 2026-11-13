import { describe, expect, it } from "vitest";
import { validateFreightRule, emptyFreightRule } from "./freight";
describe("contract configuration", () => {
  it("rejects unprovided rates instead of treating zero as a contract", () => {
    expect(validateFreightRule(emptyFreightRule())).toBe("Informe a tarifa contratual");
  });
  it("accepts the provided 0–80, 80–300 and 300–600 example only as explicit configuration", () => {
    expect(validateFreightRule({...emptyFreightRule(),metodo:"faixas",faixas:[{inicio:0,fim:80,tarifa:0.28,unidade:"kg"},{inicio:80,fim:300,tarifa:0.48,unidade:"kg"},{inicio:300,fim:600,tarifa:0.78,unidade:"kg"}]})).toBe(null);
  });
  it("rejects overlapping bands", () => {
    expect(validateFreightRule({...emptyFreightRule(),metodo:"faixas",faixas:[{inicio:0,fim:80,tarifa:0.28,unidade:"kg"},{inicio:70,fim:300,tarifa:0.48,unidade:"kg"}]})).toBe("Faixas sobrepostas ou com intervalo não coberto");
  });
  it("rejects uncovered distance gaps", () => {
    expect(validateFreightRule({...emptyFreightRule(),metodo:"faixas",faixas:[{inicio:0,fim:80,tarifa:0.28,unidade:"kg"},{inicio:90,fim:300,tarifa:0.48,unidade:"kg"}]})).toBe("Faixas sobrepostas ou com intervalo não coberto");
  });
  it("never combines ICMS and ISS", () => {
    expect(validateFreightRule({...emptyFreightRule(),tarifa:0.48,operacoes:[{nome:"ICMS",tipo:"icms",base:"frete",valor:12},{nome:"ISS",tipo:"iss",base:"frete",valor:5}]})).toBe("Configure ICMS ou ISS, não ambos");
  });
});