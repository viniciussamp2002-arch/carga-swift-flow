import { describe, expect, it } from "vitest";
import { buildPedido, guessMapping, leadTime, parseBrDate, parseBrNumber, splitPasted } from "./pedidos-rules";

describe("pedidos rancheiro", () => {
  it("lead time 20/11 → 25/11 is 5 days", () => {
    expect(leadTime("2026-11-20", "2026-11-25")).toEqual({ dias: 5, futura: false });
  });
  it("freezes lead time at the billing date", () => {
    expect(leadTime("2026-11-20", "2026-11-30", "2026-11-22").dias).toBe(2);
  });
  it("flags future screen date without inventing a value", () => {
    expect(leadTime("2026-11-28", "2026-11-25")).toEqual({ dias: null, futura: true });
  });
  it("no screen date means undefined lead time", () => {
    expect(leadTime(null, "2026-11-25").dias).toBeNull();
  });
  it("parses Brazilian numbers and dates", () => {
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("R$ 15.000,00")).toBe(15000);
    expect(parseBrDate("05/11/2026")).toBe("2026-11-05");
  });
  it("keeps leading zeros and maps columns in any order", () => {
    const rows = splitPasted("CNPJ\tPedido\tPeso\n01234567000189\t000123\t1.500,5");
    const map = guessMapping(rows[0]!);
    const { row, erros } = buildPedido(rows[1]!, map);
    expect(erros).toEqual([]);
    expect(row.numero_pedido).toBe("000123");
    expect(row.cnpj).toBe("01234567000189");
    expect(row.peso).toBe(1500.5);
  });
  it("reports a row without order number instead of dropping it", () => {
    expect(buildPedido(["", "x"], { numero_pedido: 0 }).erros).toContain("Sem número do pedido");
  });
});
