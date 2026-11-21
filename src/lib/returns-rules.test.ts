import { describe, expect, it } from "vitest";
import { returnBalance, canWithdraw, palletContents, fiscalItems } from "./returns-rules";
describe("physical return inventory", () => {
  it("no physical receipt means no available stock, even after sending information", () => { expect(returnBalance([], []).available).toBe(0); });
  it("partial withdrawal preserves the remaining balance", () => { expect(returnBalance([{ tipo: "entrada", quantidade: 5 }, { tipo: "saida", quantidade: 2 }], [])).toEqual({ received: 5, withdrawn: 2, reserved: 0, available: 3 }); });
  it("reservations reduce availability without becoming withdrawals", () => { expect(returnBalance([{ tipo: "entrada", quantidade: 5 }], [{ status: "ativa", quantidade: 3 }])).toEqual({ received: 5, withdrawn: 0, reserved: 3, available: 2 }); });
  it("cancelled collection releases reserved quantity without a withdrawal", () => { expect(returnBalance([{ tipo: "entrada", quantidade: 5 }], [{ status: "liberada", quantidade: 3 }])).toEqual({ received: 5, withdrawn: 0, reserved: 0, available: 5 }); });
  it("never allows a withdrawal above available stock", () => { expect(canWithdraw(3, 4)).toBe(false); expect(canWithdraw(3, 3)).toBe(true); });
  it("pallet labels include only the quantity assigned to that pallet", () => { expect(palletContents([{ item_id: "a", quantidade: 3 }], [{ item_id: "a", quantidade: 1 }])).toEqual([{ item_id: "a", quantidade: 2 }]); });
  it("empty pallets have no physical products to print", () => { expect(palletContents([{ item_id: "a", quantidade: 3 }], [{ item_id: "a", quantidade: 3 }])).toEqual([]); });
  it("legacy notes do not invent missing XML products", () => { expect(fiscalItems([])).toEqual([]); expect(fiscalItems([{ numero: "1" }])).toEqual([]); });
  it("fractional units retain accurate balances", () => { expect(returnBalance([{ tipo: "entrada", quantidade: 0.3 }, { tipo: "saida", quantidade: 0.1 }], []).available).toBe(0.2); });
});