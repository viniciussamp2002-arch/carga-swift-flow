import {
  CalendarClock, LayoutGrid, CalendarCheck, Package, Truck, MapPin,
  TriangleAlert, Wallet, BarChart3,
} from "lucide-react";

export const MODULES = [
  { to: "/cargas-previstas", label: "Cargas de Entrada", icon: CalendarClock },
  { to: "/notas", label: "Notas / Depósito", icon: LayoutGrid },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarCheck },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/cargas", label: "Montagem de Cargas", icon: Truck },
  { to: "/entregas", label: "Entregas", icon: MapPin },
  { to: "/ocorrencias", label: "Ocorrências", icon: TriangleAlert },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;
