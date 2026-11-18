import { describe, expect, it } from "vitest";
import { isAwaitingProofReview } from "./proof-review-rules";

describe("fila de conferência do escritório", () => {
  it.each(["canhoto", "devolucao", "recibo", "recusa", "outro", "nao_identificado"])(
    "mantém fotos do tipo %s na fila até revisão",
    (tipo_documento) => {
      for (const status of ["pendente", "identificado", "nao_identificado"]) {
        expect(isAwaitingProofReview({ status, tipo_documento })).toBe(true);
      }
    },
  );
  it.each(["aprovado", "rejeitado"])("retira comprovantes %s da fila", (status) => {
    expect(isAwaitingProofReview({ status, tipo_documento: "canhoto" })).toBe(false);
  });
});