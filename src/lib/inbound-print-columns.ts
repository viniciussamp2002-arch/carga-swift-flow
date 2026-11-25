import { fmtBRL, fmtDate, fmtDateTime, fmtNum } from "./format";

type PrintLoad = {
  numero_transporte?: string | null;
  transportadora?: string | null;
  motorista?: string | null;
  placa?: string | null;
  data_carregamento?: string | null;
  previsao_chegada?: string | null;
  data_chegada?: string | null;
};
type PrintNote = {
  numero?: string | null;
  fornecedor?: string | null;
  cliente?: string | null;
  cidade?: string | null;
  uf?: string | null;
  peso?: number | null;
  volumes?: number | null;
  valor?: number | null;
};
type PrintColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  value: (load: PrintLoad, note: PrintNote) => string | number;
};
const date = (value?: string | null) => fmtDate(value ? `${value}T12:00` : null);

export const INBOUND_PRINT_COLUMNS: PrintColumn[] = [
  { key: "transporte", label: "Transporte", value: (c) => c.numero_transporte || "—" },
  { key: "transportadora", label: "Transportadora", value: (c) => c.transportadora || "—" },
  { key: "carregamento", label: "Data do carregamento", value: (c) => date(c.data_carregamento) },
  { key: "motorista", label: "Motorista", value: (c) => c.motorista || "—" },
  { key: "placa", label: "Placa", value: (c) => c.placa || "—" },
  { key: "previsao", label: "Previsão de chegada", value: (c) => date(c.previsao_chegada) },
  { key: "chegada", label: "Chegada", value: (c) => fmtDateTime(c.data_chegada) },
  { key: "nf", label: "NF", value: (_, n) => n.numero || "—" },
  { key: "fornecedor", label: "Fornecedor", value: (_, n) => n.fornecedor || "—" },
  { key: "cliente", label: "Cliente", value: (_, n) => n.cliente || "—" },
  { key: "cidade", label: "Cidade", value: (_, n) => n.cidade || "—" },
  { key: "uf", label: "UF", value: (_, n) => n.uf || "—" },
  { key: "peso", label: "Peso (kg)", numeric: true, value: (_, n) => fmtNum(n.peso, 3) },
  { key: "volumes", label: "Volumes", numeric: true, value: (_, n) => fmtNum(n.volumes) },
  { key: "valor", label: "Valor NF", numeric: true, value: (_, n) => fmtBRL(n.valor) },
];

export const DEFAULT_INBOUND_PRINT_COLUMNS = ["transporte", "transportadora", "carregamento", "nf", "fornecedor", "cliente", "cidade", "uf", "peso", "volumes", "valor"];

export function inboundPrintData(selected: string[], load: PrintLoad, notes: PrintNote[]) {
  const columns = INBOUND_PRINT_COLUMNS.filter((c) => selected.includes(c.key));
  return {
    headers: columns.map((c) => c.label),
    rows: notes.map((n) => columns.map((c) => c.value(load, n))),
    right: columns.flatMap((c, i) => c.numeric ? [i] : []),
  };
}