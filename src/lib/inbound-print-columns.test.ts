import { describe, expect, it } from "vitest";
import { inboundPrintData } from "./inbound-print-columns";

describe("seleção de dados para impressão de cargas de entrada", () => {
  const load = { numero_transporte: "53930043", transportadora: "Transportadora teste", data_carregamento: "2026-11-25" };
  const notes = [{ numero: "250405", peso: 508.35, volumes: 50, valor: 15000 }];

  it("inclui transporte, transportadora e data do carregamento selecionados", () => {
    expect(inboundPrintData(["transporte", "transportadora", "carregamento"], load, notes).rows)
      .toEqual([["53930043", "Transportadora teste", "25/11/2026"]]);
  });

  it("omite dados desmarcados sem alterar a nota original", () => {
    expect(inboundPrintData(["nf", "volumes"], load, notes).rows).toEqual([["250405", "50"]]);
    expect(notes[0]).toEqual({ numero: "250405", peso: 508.35, volumes: 50, valor: 15000 });
  });

  it("mantém todas as notas com os mesmos dados da carga", () => {
    expect(inboundPrintData(["transporte", "nf"], load, [...notes, { numero: "250406" }]).rows)
      .toEqual([["53930043", "250405"], ["53930043", "250406"]]);
  });
});