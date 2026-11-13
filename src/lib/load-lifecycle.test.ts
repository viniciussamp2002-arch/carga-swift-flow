import { describe, expect, it } from "vitest";
import { validateLoadAction, type LoadInspection } from "./load-lifecycle";
const empty: LoadInspection = { numero: "TESTE", notas: 0, status: "prevista", situacao: "ativa", bloqueios: [], pode_excluir: true };
describe("preservação de cargas", () => {
  it("permite excluir carga sem movimentação mediante justificativa", () => expect(() => validateLoadAction("excluir", "Cadastro incorreto", empty)).not.toThrow());
  for (const link of ["Recebimento", "Entrega", "Ocorrência", "Documento", "Financeiro", "Agendamento", "Nota compartilhada", "Histórico operacional"]) {
    it(`impede exclusão com ${link}`, () => expect(() => validateLoadAction("excluir", "Teste", { ...empty, pode_excluir: false, bloqueios: [link] })).toThrow("movimentação"));
  }
  for (const action of ["excluir", "cancelar", "arquivar"] as const) {
    it(`exige justificativa para ${action}`, () => expect(() => validateLoadAction(action, "  ", empty)).toThrow("justificativa"));
  }
  it("permite cancelar com histórico", () => expect(() => validateLoadAction("cancelar", "Viagem cancelada", { ...empty, pode_excluir: false })).not.toThrow());
  it("permite arquivar carga cancelada", () => expect(() => validateLoadAction("arquivar", "Encerrada", { ...empty, situacao: "cancelada" })).not.toThrow());
  it("não cancela carga arquivada", () => expect(() => validateLoadAction("cancelar", "Teste", { ...empty, situacao: "arquivada" })).toThrow("ativas"));
  it("não repete ações em carga excluída", () => expect(() => validateLoadAction("arquivar", "Teste", { ...empty, situacao: "excluida" })).toThrow("já excluída"));
});