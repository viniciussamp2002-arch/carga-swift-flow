import {
  CalendarClock, LayoutGrid, CalendarCheck, Truck, MapPin,
  TriangleAlert, Wallet, BarChart3, ClipboardList,
} from "lucide-react";

export const MODULES = [
  { to: "/cargas-previstas", label: "Cargas de Entrada", icon: CalendarClock },
  { to: "/notas", label: "Notas / Depósito", icon: LayoutGrid },
  { to: "/pedidos-rancheiro", label: "Pedidos Rancheiro", icon: ClipboardList },
  { to: "/agendamentos", label: "Agendamentos", icon: CalendarCheck },
  { to: "/cargas", label: "Montagem de Cargas", icon: Truck },
  { to: "/entregas", label: "Entregas", icon: MapPin },
  { to: "/ocorrencias", label: "Ocorrências", icon: TriangleAlert },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;
