import { describe, expect, it } from "vitest";
import { rowsPassingOtherFilters, valueCounts } from "./column-option-counts";

const notas = [
  { fornecedor: "ITAMBÉ", cidade: "Teresina" },
  { fornecedor: "ITAMBÉ", cidade: "Teresina" },
  { fornecedor: "ITAMBÉ", cidade: "Parnaíba" },
  { fornecedor: "RANCHEIRO", cidade: "Teresina" },
  { fornecedor: "", cidade: "Teresina" },
];
const getFornecedor = (n: (typeof notas)[number]) => n.fornecedor;
const eq = (n: (typeof notas)[number], k: string, v: string) => String(n[k as "fornecedor" | "cidade"]) === v;

describe("contagem de opções no filtro de coluna", () => {
  it("mostra quantas notas existem em cada fornecedor", () => {
    expect(valueCounts(notas, getFornecedor)).toEqual(new Map([["ITAMBÉ", 3], ["RANCHEIRO", 1]]));
  });

  it("ignora fornecedor sem nome na lista de opções", () => {
    expect(valueCounts(notas, getFornecedor).has("")).toBe(false);
  });

  it("não ignora o filtro da própria coluna ao contar suas opções", () => {
    const rows = rowsPassingOtherFilters(notas, { fornecedor: "ITAMBÉ" }, "fornecedor", eq);
    expect(rows).toHaveLength(5);
  });

  it("conta sobre as que já passam pelos demais filtros", () => {
    const rows = rowsPassingOtherFilters(notas, { cidade: "Teresina" }, "fornecedor", eq);
    expect(valueCounts(rows, getFornecedor)).toEqual(new Map([["ITAMBÉ", 2], ["RANCHEIRO", 1]]));
  });
});
