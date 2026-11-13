import { describe, expect, it } from "vitest";
import { classifyKey, recipientGroupKey, validFiscalKey } from "./nfe-rules";
const key = "1".repeat(44);
describe("fiscal import rules", () => {
  it("requires 44 digits", () => { expect(validFiscalKey(key)).toBe(true); expect(validFiscalKey("1".repeat(43))).toBe(false); expect(validFiscalKey("a".repeat(44))).toBe(false); });
  it("rejects a duplicate but accepts another file", () => { const seen = new Set<string>(); expect(classifyKey(key, seen, [])).toBeNull(); expect(classifyKey(key, seen, [])).toBe("XML repetido neste lote"); expect(classifyKey("2".repeat(44), seen, [])).toBeNull(); });
  it("protects legacy grouped keys", () => { expect(classifyKey(key, new Set(), [{ chave_nfe: null, chaves_agrupadas: [key] }])).toBe("NF já cadastrada"); });
  it("groups only the same recipient in the same inbound load", () => {
    const n = { id: "1", cnpj_destinatario: "12.345.678/0001-90", carga_entrada_id: "A" };
    expect(recipientGroupKey(n)).toBe(recipientGroupKey({ ...n, id: "2", cnpj_destinatario: "12345678000190" }));
    expect(recipientGroupKey(n)).not.toBe(recipientGroupKey({ ...n, carga_entrada_id: "B" }));
    expect(recipientGroupKey(n)).not.toBe(recipientGroupKey({ ...n, cnpj_destinatario: "99999999000190" }));
  });
  it("never groups notes with missing recipient IDs", () => { expect(recipientGroupKey({ id: "1", cnpj_destinatario: null })).not.toBe(recipientGroupKey({ id: "2", cnpj_destinatario: null })); });
});