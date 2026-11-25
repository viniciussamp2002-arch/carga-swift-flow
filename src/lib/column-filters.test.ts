import { describe, expect, it } from "vitest";
import { applyColumnFilters, distinctValues, sortRows } from "./column-filters";

const rows = [{ c: "Teresina", p: 10 }, { c: "Parnaíba", p: 5 }, { c: "", p: 7 }, { c: "Teresina", p: 1 }];
const get = { c: (r: (typeof rows)[number]) => r.c, p: (r: (typeof rows)[number]) => String(r.p) };

describe("column filters", () => {
  it("filters by several selected values and treats blanks as (vazio)", () => {
    expect(applyColumnFilters(rows, { c: ["Teresina", "(vazio)"] }, get)).toHaveLength(3);
  });
  it("combines filters from multiple columns", () => {
    expect(applyColumnFilters(rows, { c: ["Teresina"], p: ["1"] }, get)).toEqual([{ c: "Teresina", p: 1 }]);
  });
  it("lists distinct values once", () => {
    expect(distinctValues(rows, get.c)).toEqual(["(vazio)", "Parnaíba", "Teresina"]);
  });
  it("sorts numerically when a numeric getter exists", () => {
    expect(sortRows(rows, { key: "p", dir: "desc" }, get, { p: (r) => r.p }).map((r) => r.p)).toEqual([10, 7, 5, 1]);
  });
});
