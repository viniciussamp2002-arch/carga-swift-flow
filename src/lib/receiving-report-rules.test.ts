import { describe, it, expect } from "vitest";
import {
  receiptStates,
  receiptTotal,
  inReportPeriod,
  validateSignedFile,
  receivingOccurrenceIds,
  signedOccurrenceIds,
} from "./receiving-report-rules";
describe("receiving reports preserve document identity", () => {
  const docs = [
    { id: "a", carga_entrada_id: "one", versao: 1, tipo: "recibo", dados: {} },
    { id: "b", carga_entrada_id: "one", versao: 2, tipo: "recibo", dados: {} },
    { id: "c", carga_entrada_id: "two", versao: 1, tipo: "recibo", dados: {} },
  ];
  it("counts only the current version, not reprints or older corrections", () => {
    const states = receiptStates(docs, new Set());
    expect(states.map((s) => s.situacao)).toEqual(["substituido", "valido", "valido"]);
    expect(receiptTotal(states.map((s) => ({ ...s, valor: 297.5 })))).toBe(595);
  });
  it("does not revive a replaced receipt after cancellation of its correction", () => {
    expect(
      receiptTotal(receiptStates(docs, new Set(["b", "c"])).map((s) => ({ ...s, valor: 297.5 }))),
    ).toBe(0);
  });
  it("sums each mixed receipt once with exact monetary rounding", () => {
    expect(
      receiptTotal([
        { situacao: "valido", valor: 370 },
        { situacao: "cancelado", valor: 100 },
        { situacao: "substituido", valor: 100 },
      ]),
    ).toBe(370);
  });
  it("uses receiving date in Fortaleza for inclusive monthly filters", () => {
    expect(inReportPeriod("2026-12-01T02:00:00Z", "2026-11-01", "2026-11-30")).toBe(true);
    expect(inReportPeriod("2026-12-01T03:00:00Z", "2026-11-01", "2026-11-30")).toBe(false);
  });
  it("only consolidates receiving occurrences from one load", () => {
    expect(
      receivingOccurrenceIds(
        [
          { id: "a", origem: "recebimento", carga_entrada_id: "one" },
          { id: "b", origem: "entrega", carga_entrada_id: "one" },
          { id: "c", origem: "recebimento", carga_entrada_id: "two" },
        ],
        "one",
      ),
    ).toEqual(["a"]);
  });
  it("a signed consolidated report covers every linked occurrence exactly once", () => {
    expect([
      ...signedOccurrenceIds(
        [
          { relatorio_id: "r", ocorrencia_id: "a" },
          { relatorio_id: "r", ocorrencia_id: "b" },
          { relatorio_id: "s", ocorrencia_id: "c" },
        ],
        [{ relatorio_id: "r" }],
      ),
    ]).toEqual(["a", "b"]);
  });
  it("accepts PDF or camera image but rejects other file types", () => {
    expect(() => validateSignedFile({ type: "application/pdf", size: 200 })).not.toThrow();
    expect(() => validateSignedFile({ type: "image/jpeg", size: 200 })).not.toThrow();
    expect(() => validateSignedFile({ type: "text/html", size: 200 })).toThrow();
  });
  it("rejects files beyond 15 MB", () => {
    expect(() =>
      validateSignedFile({ type: "application/pdf", size: 15 * 1024 * 1024 + 1 }),
    ).toThrow();
  });
});
