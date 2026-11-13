export interface FreightBand { inicio: number; fim: number; unidade: "kg" | "tonelada" | "fixo"; tarifa: number }
export interface FreightOperation { nome: string; tipo: "percentual" | "fixo" | "minimo" | "icms" | "iss"; base: "nf" | "frete" | "acumulado" | "contratual"; valor: number; por_dentro?: boolean; cidade?: string; uf?: string }
export interface FreightRule { metodo: "kg" | "tonelada" | "percentual" | "fixo" | "faixas"; tarifa: number; minimo: number; base_percentual: "nf" | "contratual"; base_contratual: number; faixas: FreightBand[]; operacoes: FreightOperation[] }
export const emptyFreightRule = (): FreightRule => ({ metodo: "kg", tarifa: 0, minimo: 0, base_percentual: "nf", base_contratual: 0, faixas: [], operacoes: [] });
export function validateFreightRule(rule: FreightRule): string | null {
  if (rule.metodo !== "faixas" && (!Number.isFinite(rule.tarifa) || rule.tarifa <= 0)) return "Informe a tarifa contratual";
  if (rule.metodo === "faixas") {
    if (!rule.faixas.length) return "Cadastre as faixas";
    let previous = 0;
    for (const b of [...rule.faixas].sort((a,b)=>a.inicio-b.inicio)) {
      if (b.inicio !== previous) return "Faixas sobrepostas ou com intervalo não coberto";
      if (![b.inicio,b.fim,b.tarifa].every(Number.isFinite) || b.fim <= b.inicio || b.tarifa <= 0) return "Complete as faixas e tarifas";
      previous = b.fim;
    }
  }
  if (rule.operacoes.some(o=>o.tipo==="icms") && rule.operacoes.some(o=>o.tipo==="iss")) return "Configure ICMS ou ISS, não ambos";
  for (const op of rule.operacoes) {
    if (!op.nome.trim() || !Number.isFinite(op.valor) || op.valor <= 0) return "Complete os adicionais e tributos";
    if ((op.tipo==="icms" || op.tipo==="iss" || op.por_dentro) && op.valor >= 100) return "Percentual inválido";
  }
  return null;
}
export const FREIGHT_STATES: Record<string,string> = { sem_tabela:"Sem tabela de frete",aguardando_distancia:"Aguardando distância",calculo_pendente:"Cálculo pendente",pre_calculado:"Pré-calculado",aguardando_conferencia:"Entregue — conferir financeiro",conferido:"Conferido",pronto_faturamento:"Pronto para faturamento",faturado:"Faturado",aprovacao_revertida:"Aprovação revertida" };