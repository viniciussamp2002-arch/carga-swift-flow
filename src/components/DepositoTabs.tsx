import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/cargas-previstas", label: "Cargas de Entrada" },
  { to: "/notas", label: "Notas Fiscais / Depósito" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/clientes-agendamento", label: "Clientes c/ Agendamento" },
] as const;

export function DepositoTabs() {
  return (
    <nav className="mb-4 flex gap-1 border-b overflow-x-auto">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to}
          className="px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          activeProps={{ className: "!border-accent-foreground !text-primary !border-b-[color:var(--color-primary)]" }}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
