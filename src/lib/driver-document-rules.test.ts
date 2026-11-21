import { describe, expect, it } from "vitest";
import { driverNoteState, loadAllowsDocuments, DRIVER_ORDER } from "./driver-document-rules";
describe("driver documents", () => {
  it("allows viewing while the assigned load is in progress", () => { expect(loadAllowsDocuments({ situacao: "ativa", status: "em_rota", data_finalizacao: null })).toBe(true); });
  it("withdraws access after finalization without deleting a file", () => { expect(loadAllowsDocuments({ situacao: "ativa", status: "finalizada", data_finalizacao: null })).toBe(false); });
  it("also rejects a finalized timestamp independently of transport status", () => { expect(loadAllowsDocuments({ situacao: "ativa", status: "em_rota", data_finalizacao: "2026-11-21T12:00:00Z" })).toBe(false); });
  it("photo submission alone never approves delivery", () => { expect(driverNoteState("em_rota", { status: "identificado", triagem: "pendente", tipo_documento: "canhoto" })).toBe("analise"); });
  it("approved receipt requires the office-confirmed delivered note", () => { expect(driverNoteState("entregue", { status: "aprovado", triagem: "analisado", tipo_documento: "canhoto" })).toBe("aprovada"); expect(driverNoteState("em_rota", { status: "aprovado", triagem: "analisado", tipo_documento: "canhoto" })).not.toBe("aprovada"); });
  it("a complementary document never fulfills the pending receipt", () => { expect(driverNoteState("em_rota", { status: "identificado", triagem: "analisado", tipo_documento: "devolucao" })).toBe("pendente"); });
  it("requires another photograph after office rejection", () => { expect(driverNoteState("em_rota", { status: "rejeitado", triagem: "nova_foto", tipo_documento: "canhoto" })).toBe("correcao"); });
  it("prioritizes correction and pending ahead of analysis and approval", () => { expect(DRIVER_ORDER.correcao).toBeLessThan(DRIVER_ORDER.pendente); expect(DRIVER_ORDER.pendente).toBeLessThan(DRIVER_ORDER.analise); expect(DRIVER_ORDER.analise).toBeLessThan(DRIVER_ORDER.aprovada); });
});