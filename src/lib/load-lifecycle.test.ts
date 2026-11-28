import { describe, expect, it } from "vitest";
import { canAddNotesToOutboundLoad, canEditOutboundLoad, canRemoveOutboundNotes, canUndoOutboundLoad, notesRemovableFromOutboundLoad, validateLoadAction, type LoadInspection } from "./load-lifecycle";
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

describe("montagem de cargas de saída", () => {
  it("permite editar carga em separação e em rota", () => {
    expect(canEditOutboundLoad({ status: "separacao", situacao: "ativa" })).toBe(true);
    expect(canEditOutboundLoad({ status: "em_rota", situacao: "ativa" })).toBe(true);
  });
  it("não edita carga finalizada ou cancelada", () => {
    expect(canEditOutboundLoad({ status: "finalizada", situacao: "ativa" })).toBe(false);
    expect(canEditOutboundLoad({ status: "separacao", situacao: "cancelada" })).toBe(false);
  });
  it("remove notas somente durante separação ou carregamento", () => {
    expect(canRemoveOutboundNotes({ status: "separacao", situacao: "ativa" })).toBe(true);
    expect(canRemoveOutboundNotes({ status: "carregamento", situacao: "ativa" })).toBe(true);
    expect(canRemoveOutboundNotes({ status: "em_rota", situacao: "ativa" })).toBe(false);
    expect(canRemoveOutboundNotes({ status: "separacao", situacao: "cancelada" })).toBe(false);
  });
  it("desfaz montagem mas nunca exclui carga em rota ou finalizada", () => {
    expect(canUndoOutboundLoad({ status: "separacao", situacao: "ativa" })).toBe(true);
    expect(canUndoOutboundLoad({ status: "carregamento", situacao: "ativa" })).toBe(true);
    expect(canUndoOutboundLoad({ status: "em_rota", situacao: "ativa" })).toBe(false);
    expect(canUndoOutboundLoad({ status: "finalizada", situacao: "ativa" })).toBe(false);
    expect(canUndoOutboundLoad({ status: "separacao", situacao: "excluida" })).toBe(false);
  });
});
describe("adicionar e retirar notas de uma carga pela tela do depósito", () => {
  const livre = { status: "disponivel", carga_id: null };
  const naCarga = (status: string, situacao: string, notaStatus = "separacao") =>
    ({ status: notaStatus, carga_id: "c1", cargas: { status, situacao } });
  it("monta carga apenas com notas livres do depósito", () => {
    expect(canAddNotesToOutboundLoad([livre])).toBe(true);
    expect(canAddNotesToOutboundLoad([])).toBe(false);
    expect(canAddNotesToOutboundLoad([livre, naCarga("separacao", "ativa")])).toBe(false);
    expect(canAddNotesToOutboundLoad([{ status: "separacao", carga_id: null }])).toBe(false);
  });
  it("retira nota de carga ativa em separação ou carregamento", () => {
    expect(notesRemovableFromOutboundLoad([naCarga("separacao", "ativa")])).toHaveLength(1);
    expect(notesRemovableFromOutboundLoad([naCarga("carregamento", "ativa")])).toHaveLength(1);
  });
  it("não retira nota de carga em rota, finalizada ou cancelada", () => {
    expect(notesRemovableFromOutboundLoad([naCarga("em_rota", "ativa")])).toHaveLength(0);
    expect(notesRemovableFromOutboundLoad([naCarga("finalizada", "ativa")])).toHaveLength(0);
    expect(notesRemovableFromOutboundLoad([naCarga("separacao", "cancelada")])).toHaveLength(0);
    expect(notesRemovableFromOutboundLoad([naCarga("separacao", "excluida")])).toHaveLength(0);
  });
  it("não retira nota que já está no depósito nem nota em outro estágio", () => {
    expect(notesRemovableFromOutboundLoad([livre])).toHaveLength(0);
    expect(notesRemovableFromOutboundLoad([naCarga("separacao", "ativa", "entregue")])).toHaveLength(0);
  });
  it("retira somente as notas permitidas quando a seleção é mista", () => {
    const permitido = naCarga("separacao", "ativa");
    const resultado = notesRemovableFromOutboundLoad([livre, permitido, naCarga("em_rota", "ativa")]);
    expect(resultado).toEqual([permitido]);
  });
});
