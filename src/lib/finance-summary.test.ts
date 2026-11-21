import { expect, it } from "vitest";
import { financeSummary } from "./finance-summary";
it("aggregates each NF once and distinguishes projected from approved freight", () => {
  expect(financeSummary([{ id: "a", grupo: "Fornecedor A", valor: 50, previsao: true }, { id: "a", grupo: "Fornecedor A", valor: 50, previsao: true }, { id: "b", grupo: "Fornecedor A", valor: 65, previsao: false }])).toEqual([{ grupo: "Fornecedor A", notas: 2, previsto: 50, aprovado: 65 }]);
});
it("missing financial parameters do not become invented amounts", () => { expect(financeSummary([{ id: "a", grupo: "Carga A", valor: null, previsao: true }])[0]?.previsto).toBe(0); });