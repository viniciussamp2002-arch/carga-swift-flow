import { describe, expect, it } from "vitest";
import { applyColumnFilters, cascadeOptions } from "./column-filters";

const rows = [
  { t: "1", nf: "100", f: "ITAMBÉ" }, { t: "1", nf: "101", f: "BELA VISTA" },
  { t: "2", nf: "200", f: "ITAMBÉ" }, { t: "2", nf: "201", f: "ITAMBÉ" },
];
const get = { t: (r: any) => r.t, nf: (r: any) => r.nf, f: (r: any) => r.f };

describe("cascadeOptions", () => {
  it("lista no filtro de NF apenas as notas do transporte já filtrado", () => {
    const r = cascadeOptions(rows, { t: ["1"] }, get, "nf");
    expect(r.options.map((o) => o.value)).toEqual(["100", "101"]);
    expect(r.total).toBe(2);
  });
  it("conta registros por opção respeitando os outros filtros", () => {
    const r = cascadeOptions(rows, { t: ["2"] }, get, "f");
    expect(r.options).toEqual([{ value: "ITAMBÉ", count: 2 }]);
  });
  it("a própria coluna não restringe suas opções", () => {
    expect(cascadeOptions(rows, { t: ["1"] }, get, "t").options.map((o) => o.value)).toEqual(["1", "2"]);
  });
  it("seleção múltipla combina valores da mesma coluna", () => {
    expect(applyColumnFilters(rows, { nf: ["100", "200"] }, get)).toHaveLength(2);
  });
});
