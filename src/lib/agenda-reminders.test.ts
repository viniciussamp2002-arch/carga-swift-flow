import { describe, it, expect } from "vitest";
import { classifyReminder, operationDate, operationalSituation } from "./agenda-reminders";

const today = "2026-11-19";
describe("lembretes de agendamento", () => {
  it("agendada para o dia 20 aparece no dia 19", () => expect(classifyReminder({ data_agendada: "2026-11-20", status: "confirmado" }, "disponivel", today)).toBe("amanha"));
  it("data passada sem entrega fica vencida", () => expect(classifyReminder({ data_agendada: "2026-11-10", status: "confirmado" }, "em_rota", today)).toBe("vencido"));
  it("sem data fica aguardando agendamento", () => expect(classifyReminder({ data_agendada: null, status: "nao_solicitado" }, "disponivel", today)).toBe("aguardando"));
  it("entregue sai das pendências", () => expect(classifyReminder({ data_agendada: "2026-11-20", status: "confirmado" }, "entregue", today)).toBeNull());
  it("agendada para depois de amanhã não gera lembrete", () => expect(classifyReminder({ data_agendada: "2026-11-21", status: "confirmado" }, "disponivel", today)).toBeNull());
  it("usa o fuso de Teresina", () => expect(operationDate(new Date("2026-11-20T02:00:00Z"))).toBe("2026-11-19"));
  it("situação no dia é entrega pendente", () => expect(operationalSituation({ data_agendada: today, status: "confirmado" }, "em_rota", today)).toBe("Entrega pendente"));
});
