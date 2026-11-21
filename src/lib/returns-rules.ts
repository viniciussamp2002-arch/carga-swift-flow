import Decimal from "decimal.js";
import type { NFeItem } from "./xml-parser";
export const RETURN_REASONS: Record<string, string> = { avaria: "Avaria", falta: "Falta", sobra: "Sobra", recusa: "Recusa do cliente", vencido: "Produto vencido", proximo_vencimento: "Próximo do vencimento", divergencia: "Divergência", outro: "Outro motivo" };
export function fiscalItems(value: unknown): NFeItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is NFeItem => !!x && typeof x.numero === "string" && typeof x.codigo === "string" && typeof x.descricao === "string" && typeof x.unidade === "string" && typeof x.quantidade === "number");
}
export function returnBalance(moves: { tipo: string; quantidade: number }[], reservations: { status: string; quantidade: number }[]) {
  const received = moves.filter(m => m.tipo === "entrada").reduce((s, m) => s.plus(m.quantidade), new Decimal(0));
  const withdrawn = moves.filter(m => m.tipo === "saida").reduce((s, m) => s.plus(m.quantidade), new Decimal(0));
  const reserved = reservations.filter(r => r.status === "ativa").reduce((s, r) => s.plus(r.quantidade), new Decimal(0));
  return { received: received.toNumber(), withdrawn: withdrawn.toNumber(), reserved: reserved.toNumber(), available: received.minus(withdrawn).minus(reserved).toNumber() };
}
export function canWithdraw(available: number, quantity: number) { return Number.isFinite(quantity) && quantity > 0 && new Decimal(quantity).lte(available); }
export function palletContents<T extends { item_id: string; quantidade: number }>(allocations: T[], exits: { item_id: string; quantidade: number }[]) {
  return allocations.map(a => ({ ...a, quantidade: new Decimal(a.quantidade).minus(exits.filter(e => e.item_id === a.item_id).reduce((s, e) => s.plus(e.quantidade), new Decimal(0))).toNumber() })).filter(a => a.quantidade > 0);
}