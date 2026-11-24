import { describe, it, expect } from "vitest";
import { classificarPrazo, permanencia, resultadoEntrega, hojeTeresina } from "./deadline-rules";
const H = "2026-11-24";
describe("prazos de entrega", () => {
  it("vence hoje não é atraso", () => expect(classificarPrazo(H, H)).toMatchObject({ prazo: "proximo", texto: "Vence hoje" }));
  it("2 dias é próximo", () => expect(classificarPrazo("2026-11-26", H).texto).toBe("Vence em 2 dias"));
  it("3 dias é no prazo", () => expect(classificarPrazo("2026-11-27", H).prazo).toBe("no_prazo"));
  it("ontem é 1 dia de atraso", () => expect(classificarPrazo("2026-11-23", H).texto).toBe("1 dia de atraso"));
  it("sem previsão não é atraso", () => expect(classificarPrazo(null, H).prazo).toBe("sem_previsao"));
  it("permanência", () => { expect(permanencia(H, H)).toBe("Recebida hoje"); expect(permanencia("2026-11-14", H)).toBe("10 dias no depósito"); });
  it("entrega com atraso", () => expect(resultadoEntrega("2026-11-20", "2026-11-23T15:00:00Z")).toBe("Com atraso (3 dias)"));
  it("fuso Teresina", () => expect(hojeTeresina(new Date("2026-11-25T02:00:00Z"))).toBe("2026-11-24"));
});
